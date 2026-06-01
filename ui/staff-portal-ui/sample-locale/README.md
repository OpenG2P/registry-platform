## Sample Locale Reference

Translations are handled dynamically at runtime. The `sample-locale` folder is not used directly in application code; it is only a reference for how translation JSON should be organized into `core` and `domain`.

- `core`: Platform-level translations. This includes common keys and labels used across the product and labels used by all features in the platform (for example: register, configuration, change request, incoming message, and other shared or feature-level modules).
- `domain`: Registry/domain-specific translations. This includes field labels, section labels, register labels, and other domain-related UI text.
- Note: Try to maintain all field labels and section labels as snake_case keys.