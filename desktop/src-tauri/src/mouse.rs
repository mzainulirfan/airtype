use enigo::{Axis, Button, Coordinate, Direction, Enigo, Mouse, Settings};
use std::sync::Mutex;

pub struct MouseSimulator {
    /// (enigo, last applied relative dx, last applied relative dy)
    inner: Mutex<(Enigo, i32, i32)>,
}

impl MouseSimulator {
    pub fn new() -> Self {
        let enigo = Enigo::new(&Settings::default()).expect("failed to init Enigo");
        MouseSimulator { inner: Mutex::new((enigo, 0, 0)) }
    }

    /// Move the cursor relative to its current position. `Coordinate::Rel` on
    /// Windows is subject to the system mouse speed/acceleration settings.
    /// To hide network latency the cursor is extrapolated slightly along the
    /// previous direction, so it keeps tracking the finger between batches.
    pub fn move_relative(&self, dx: i32, dy: i32) -> Result<(), String> {
        if dx == 0 && dy == 0 {
            return Ok(());
        }
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let (enigo, prev_dx, prev_dy) = &mut *inner;
        // Add ~1/3 of the previous delta (capped) so sustained movement leads
        // just enough to feel immediate, without running away on direction
        // changes.
        let predict = |prev: i32| (prev / 3).clamp(-12, 12);
        let pdx = predict(*prev_dx);
        let pdy = predict(*prev_dy);
        *prev_dx = dx;
        *prev_dy = dy;
        enigo
            .move_mouse(dx + pdx, dy + pdy, Coordinate::Rel)
            .map_err(|e| format!("mouse move failed: {e}"))
    }

    pub fn button(&self, button: Button, direction: Direction) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner
            .0
            .button(button, direction)
            .map_err(|e| format!("mouse button failed: {e}"))
    }

    /// `axis` is `Axis::Vertical` by default; `delta` is a number of wheel
    /// notches (positive = down/right per enigo's convention).
    pub fn scroll(&self, delta: i32, axis: Axis) -> Result<(), String> {
        if delta == 0 {
            return Ok(());
        }
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner
            .0
            .scroll(delta, axis)
            .map_err(|e| format!("mouse scroll failed: {e}"))
    }
}
