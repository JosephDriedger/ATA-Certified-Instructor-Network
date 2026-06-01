
class ValidationMessages {
    // Registration
    static firstNameRequired  = 'First name is required.';
    static lastNameRequired   = 'Last name is required.';
    static emailRequired      = 'Email address is required.';
    static emailInvalid       = 'Please enter a valid email address.';
    static emailTaken         = 'An account with this email already exists.';
    static passwordRequired   = 'Password is required.';
    static passwordTooShort   = 'Password must be at least 8 characters.';
    static passwordTooWeak    = 'Password must include at least one uppercase letter and one number.';
    static passwordMismatch   = 'Passwords do not match.';
    static roleRequired       = 'Please select an account type.';
    static roleInvalid        = 'Invalid account type selected.';

    // Login
    static invalidCredentials = 'Incorrect email or password.';
    static accountInactive    = 'Your account has been deactivated. Contact support for help.';
}

module.exports = ValidationMessages;
