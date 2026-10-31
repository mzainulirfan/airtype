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
    /// `None` when the OS input driver could not be initialized (for example a
    /// headless session). The app keeps running and reports per-event errors
    /// instead of panicking at startup.
    inner: Mutex<(Option<Enigo>, ModifierState)>,
}

impl KeyboardSimulator {
    pub fn new() -> Self {
        let driver = match Enigo::new(&Settings::default()) {
            Ok(enigo) => Some(enigo),
            Err(e) => {
                eprintln!("[airtype] input keyboard tidak tersedia: {e}");
                None
            }
        };
        KeyboardSimulator {
            inner: Mutex::new((driver, ModifierState::default())),
        }
    }

    fn driver(inner: &mut (Option<Enigo>, ModifierState)) -> Result<&mut Enigo, String> {
        inner
            .0
            .as_mut()
            .ok_or_else(|| "input driver tidak tersedia (Enigo)".to_string())
    }

    /// Press any modifier reported in `desired` that is not already pressed.
    /// Called on key_down so the snapshot from mobile is honored.
    fn press_missing(inner: &mut (Option<Enigo>, ModifierState), desired: &Modifiers) {
        let (driver, state) = &mut *inner;
        if let Some(enigo) = driver {
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
        }
        state.shift |= desired.shift;
        state.ctrl |= desired.ctrl;
        state.alt |= desired.alt;
        state.meta |= desired.meta;
    }

    /// Release any modifier that is pressed but no longer reported.
    /// Called on key_up to clean up stuck modifier state.
    fn release_unneeded(inner: &mut (Option<Enigo>, ModifierState), desired: &Modifiers) {
        let (driver, state) = &mut *inner;
        if let Some(enigo) = driver {
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

    /// Modifier keys are driven entirely by the modifiers snapshot so the
    /// explicit press/release below does not double-fire them.
    fn is_modifier_code(code: &str) -> bool {
        matches!(
            code,
            "ShiftLeft"
                | "ShiftRight"
                | "ControlLeft"
                | "ControlRight"
                | "AltLeft"
                | "AltRight"
                | "MetaLeft"
                | "MetaRight"
        )
    }

    pub fn key_down(&self, code: &str, _key: &str, modifiers: &Modifiers) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        Self::press_missing(&mut inner, modifiers);
        if Self::is_modifier_code(code) {
            return Ok(());
        }
        let key = Self::resolve_key(code)?;
        Self::driver(&mut inner)?
            .key(key, Direction::Press)
            .map_err(|e| format!("enigo key_down failed for {code}: {e}"))
    }

    pub fn key_up(&self, code: &str, _key: &str, modifiers: &Modifiers) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if Self::is_modifier_code(code) {
            Self::release_unneeded(&mut inner, modifiers);
            return Ok(());
        }
        let key = Self::resolve_key(code)?;
        Self::driver(&mut inner)?
            .key(key, Direction::Release)
            .map_err(|e| format!("enigo key_up failed for {code}: {e}"))?;
        Self::release_unneeded(&mut inner, modifiers);
        Ok(())
    }

    /// Fast-path: type plain text, mapping newline to real Enter presses.
    pub fn type_text(&self, text: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let enigo = Self::driver(&mut inner)?;

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
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let (driver, state) = &mut *inner;
        if let Some(enigo) = driver {
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
        }
        *state = ModifierState::default();
    }
}
