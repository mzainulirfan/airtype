use enigo::Key;

/// Map a KeyboardEvent.code (letters/digits/symbols) to a character.
/// Only used for keys that should be simulated as Unicode.
pub fn code_to_char(code: &str) -> Option<char> {
    let ch = match code {
        "KeyA" => 'a', "KeyB" => 'b', "KeyC" => 'c', "KeyD" => 'd', "KeyE" => 'e',
        "KeyF" => 'f', "KeyG" => 'g', "KeyH" => 'h', "KeyI" => 'i', "KeyJ" => 'j',
        "KeyK" => 'k', "KeyL" => 'l', "KeyM" => 'm', "KeyN" => 'n', "KeyO" => 'o',
        "KeyP" => 'p', "KeyQ" => 'q', "KeyR" => 'r', "KeyS" => 's', "KeyT" => 't',
        "KeyU" => 'u', "KeyV" => 'v', "KeyW" => 'w', "KeyX" => 'x', "KeyY" => 'y',
        "KeyZ" => 'z',
        "Digit0" => '0', "Digit1" => '1', "Digit2" => '2', "Digit3" => '3',
        "Digit4" => '4', "Digit5" => '5', "Digit6" => '6', "Digit7" => '7',
        "Digit8" => '8', "Digit9" => '9',
        "Minus" => '-', "Equal" => '=', "BracketLeft" => '[', "BracketRight" => ']',
        "Backslash" => '\\', "Semicolon" => ';', "Quote" => '\'', "Backquote" => '`',
        "Comma" => ',', "Period" => '.', "Slash" => '/',
        _ => return None,
    };
    Some(ch)
}

/// Map special/modifier/function codes to enigo Key.
pub fn code_to_key(code: &str) -> Option<Key> {
    if let Some(n) = code.strip_prefix('F').and_then(|s| s.parse::<u8>().ok()) {
        let key = match n {
            1 => Key::F1, 2 => Key::F2, 3 => Key::F3, 4 => Key::F4,
            5 => Key::F5, 6 => Key::F6, 7 => Key::F7, 8 => Key::F8,
            9 => Key::F9, 10 => Key::F10, 11 => Key::F11, 12 => Key::F12,
            _ => return None,
        };
        return Some(key);
    }

    let key = match code {
        "Enter" | "NumpadEnter" => Key::Return,
        "Tab" => Key::Tab,
        "Backspace" => Key::Backspace,
        "Delete" => Key::Delete,
        "Home" => Key::Home,
        "End" => Key::End,
        "PageUp" => Key::PageUp,
        "PageDown" => Key::PageDown,
        "ArrowUp" => Key::UpArrow,
        "ArrowDown" => Key::DownArrow,
        "ArrowLeft" => Key::LeftArrow,
        "ArrowRight" => Key::RightArrow,
        "Space" => Key::Space,
        "Escape" => Key::Escape,
        "Insert" => Key::Insert,
        "CapsLock" => Key::CapsLock,
        "ShiftLeft" | "ShiftRight" => Key::Shift,
        "ControlLeft" | "ControlRight" => Key::Control,
        "AltLeft" | "AltRight" => Key::Alt,
        "MetaLeft" | "MetaRight" => Key::Meta,
        _ => return None,
    };
    Some(key)
}
