use enigo::{Axis, Button, Coordinate, Direction, Enigo, Mouse, Settings};
use std::sync::Mutex;

pub struct MouseSimulator {
    inner: Mutex<Enigo>,
}

impl MouseSimulator {
    pub fn new() -> Self {
        let enigo = Enigo::new(&Settings::default()).expect("failed to init Enigo");
        MouseSimulator { inner: Mutex::new(enigo) }
    }

    /// Move the cursor relative to its current position. `Coordinate::Rel` on
    /// Windows is subject to the system mouse speed/acceleration settings.
    pub fn move_relative(&self, dx: i32, dy: i32) -> Result<(), String> {
        if dx == 0 && dy == 0 {
            return Ok(());
        }
        let mut enigo = self.inner.lock().unwrap();
        enigo
            .move_mouse(dx, dy, Coordinate::Rel)
            .map_err(|e| format!("mouse move failed: {e}"))
    }

    pub fn button(&self, button: Button, direction: Direction) -> Result<(), String> {
        let mut enigo = self.inner.lock().unwrap();
        enigo
            .button(button, direction)
            .map_err(|e| format!("mouse button failed: {e}"))
    }

    /// `axis` is `Axis::Vertical` by default; `delta` is a number of wheel
    /// notches (positive = down/right per enigo's convention).
    pub fn scroll(&self, delta: i32, axis: Axis) -> Result<(), String> {
        if delta == 0 {
            return Ok(());
        }
        let mut enigo = self.inner.lock().unwrap();
        enigo
            .scroll(delta, axis)
            .map_err(|e| format!("mouse scroll failed: {e}"))
    }
}
