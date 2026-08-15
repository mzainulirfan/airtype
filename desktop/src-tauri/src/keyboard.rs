use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::sync::Mutex;

use crate::keymap::{code_to_char, code_to_key};
use crate::types::Modifiers;

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub struct ModifierState {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

pub struct KeyboardSimulator {
    inner: Mutex<(Enigo, ModifierState)>,
}

impl KeyboardSimulator {
    pub fn new() -> Self {
        let enigo = Enigo::new(&Settings::default()).expect("failed to init Enigo");
        KeyboardSimulator {
            inner: Mutex::new((enigo, ModifierState::default())),
        }
    }

    /// Press any modifier reported in `desired` that is not already pressed.
    /// Called on key_down so the snapshot from mobile is honored.
    fn press_missing(inner: &mut (Enigo, ModifierState), desired: &Modifiers) {
        let (enigo, state) = &mut *inner;
        let pairs = [
            (desired.shift, state.shift, Key::Shift),
            (desired.ctrl, state.ctrl, Key::Control),
            (desired.alt, state.alt, Key::Alt),
            (desired.meta, state.meta, Key::Meta),
        ];
        for (desired_on, current_on, key) in pairs {
            if desired_on && !current_on {
                let _ = enigo.key(key, Direction::Press);
            }
        }
        state.shift |= desired.shift;
        state.ctrl |= desired.ctrl;
        state.alt |= desired.alt;
        state.meta |= desired.meta;
    }

    /// Release any modifier that is pressed but no longer reported.
    /// Called on key_up to clean up stuck modifier state.
    fn release_unneeded(inner: &mut (Enigo, ModifierState), desired: &Modifiers) {
        let (enigo, state) = &mut *inner;
        let pairs = [
            (desired.shift, state.shift, Key::Shift),
            (desired.ctrl, state.ctrl, Key::Control),
            (desired.alt, state.alt, Key::Alt),
            (desired.meta, state.meta, Key::Meta),
        ];
        for (desired_on, current_on, key) in pairs {
            if !desired_on && current_on {
                let _ = enigo.key(key, Direction::Release);
            }
        }
        state.shift = desired.shift;
        state.ctrl = desired.ctrl;
        state.alt = desired.alt;
        state.meta = desired.meta;
    }

    fn resolve_key(code: &str) -> Result<Key, String> {
        code_to_key(code)
            .or_else(|| code_to_char(code).map(Key::Unicode))
            .ok_or_else(|| format!("unknown key code: {code}"))
    }

    pub fn key_down(&self, code: &str, _key: &str, modifiers: &Modifiers) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        Self::press_missing(&mut inner, modifiers);
        let key = Self::resolve_key(code)?;
        inner
            .0
            .key(key, Direction::Press)
            .map_err(|e| format!("enigo key_down failed for {code}: {e}"))
    }

    pub fn key_up(&self, code: &str, _key: &str, modifiers: &Modifiers) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        let key = Self::resolve_key(code)?;
        inner
            .0
            .key(key, Direction::Release)
            .map_err(|e| format!("enigo key_up failed for {code}: {e}"))?;
        Self::release_unneeded(&mut inner, modifiers);
        Ok(())
    }

    /// Fast-path: type plain text, mapping newline to real Enter presses.
    pub fn type_text(&self, text: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        let enigo = &mut inner.0;

        let segments: Vec<&str> = text.split('\n').collect();
        let count = segments.len();
        for (i, segment) in segments.into_iter().enumerate() {
            if !segment.is_empty() {
                enigo
                    .text(segment)
                    .map_err(|e| format!("enigo text failed: {e}"))?;
            }
            if i + 1 < count {
                enigo
                    .key(Key::Return, Direction::Press)
                    .and_then(|_| enigo.key(Key::Return, Direction::Release))
                    .map_err(|e| format!("enigo Enter failed: {e}"))?;
            }
        }
        Ok(())
    }

    pub fn release_all(&self) {
        let mut inner = self.inner.lock().unwrap();
        let (enigo, state) = &mut *inner;
        if state.shift {
            let _ = enigo.key(Key::Shift, Direction::Release);
        }
        if state.ctrl {
            let _ = enigo.key(Key::Control, Direction::Release);
        }
        if state.alt {
            let _ = enigo.key(Key::Alt, Direction::Release);
        }
        if state.meta {
            let _ = enigo.key(Key::Meta, Direction::Release);
        }
        *state = ModifierState::default();
    }
}
