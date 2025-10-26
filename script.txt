document.addEventListener('DOMContentLoaded', function() {
    // Clear form on page load/refresh
    const form = document.getElementById('newsletterForm');
    if (form) {
        form.reset();
    }
    
    // Get DOM elements
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const formStatus = document.getElementById('form-status');
    const nameError = document.getElementById('name-error');
    const phoneError = document.getElementById('phone-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    const termsCheckbox = form.querySelector('[name="terms_agreement"]');
    const consentCheckbox = form.querySelector('[name="monthly_newsletter_consent"]');
    
    // --- Validation Functions ---
    
    /**
     * Validates name - must contain only letters and spaces, minimum 2 characters
     * @param {string} name - The name to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    function validateName(name) {
        const trimmed = name.trim();
        if (trimmed.length < 2) return false;
        return /^[a-zA-Z\s]+$/.test(trimmed);
    }

    /**
     * Validates Indian phone number
     * - Must be exactly 10 digits
     * - Must start with 6, 7, 8, or 9
     * - Cannot be all same digits
     * @param {string} phone - The phone number to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    function validatePhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        
        // Check length
        if (cleaned.length !== 10) return false;
        
        // Check if starts with valid digit (6-9)
        if (!/^[6-9]/.test(cleaned)) return false;
        
        // Check not all same digits (e.g., 9999999999)
        if (/^(\d)\1{9}$/.test(cleaned)) return false;
        
        return true;
    }
    
    /**
     * Removes all non-digit characters from phone number
     * @param {string} phone - The phone number to clean
     * @returns {string} - Cleaned phone number with only digits
     */
    function cleanPhoneNumber(phone) {
        return phone.replace(/\D/g, '');
    }

    /**
     * Displays error message and adds shake animation
     * @param {HTMLElement} element - The error message element
     * @param {string} message - The error message to display
     */
    function showError(element, message) {
        element.textContent = message;
        element.parentElement.classList.add('error-shake');
        setTimeout(() => element.parentElement.classList.remove('error-shake'), 400);
    }

    /**
     * Clears error message
     * @param {HTMLElement} element - The error message element
     */
    function clearError(element) {
        element.textContent = '';
    }

    /**
     * Sets button loading state
     * @param {boolean} loading - True to enable loading state, false to disable
     */
    function setButtonState(loading) {
        submitBtn.disabled = loading;
        if (loading) {
            submitBtn.classList.add('loading');
            submitBtn.setAttribute('aria-busy', 'true');
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.removeAttribute('aria-busy');
        }
    }

    /**
     * Disables/enables all form inputs
     * @param {boolean} disabled - Whether to disable the inputs
     */
    function setFormInputsState(disabled) {
        nameInput.disabled = disabled;
        phoneInput.disabled = disabled;
        termsCheckbox.disabled = disabled;
        consentCheckbox.disabled = disabled;
    }

    /**
     * Highlights checkbox labels with error styling
     * @param {HTMLElement} checkbox - The checkbox element
     * @param {boolean} hasError - Whether to show error styling
     */
    function highlightCheckbox(checkbox, hasError) {
        const label = checkbox.closest('.consent-label');
        if (hasError) {
            label.style.color = '#ff6b6b';
            label.classList.add('error-shake');
            setTimeout(() => label.classList.remove('error-shake'), 400);
        } else {
            label.style.color = '';
        }
    }

    /**
     * Auto-clears status message after delay
     * @param {number} delay - Milliseconds to wait before clearing
     */
    function autoClearStatus(delay = 5000) {
        setTimeout(() => {
            formStatus.textContent = '';
            formStatus.className = '';
        }, delay);
    }

    /**
     * Checks if submission was too fast (likely a bot)
     * @returns {boolean} - True if submission seems legitimate
     */
    const formLoadTime = Date.now();
    function checkSubmissionTiming() {
        const timeSinceLoad = Date.now() - formLoadTime;
        return timeSinceLoad > 3000; // Must be at least 3 seconds
    }

    // --- Form Submission Handler ---
    
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            // Clear previous messages
            formStatus.textContent = '';
            formStatus.className = '';
            clearError(nameError);
            clearError(phoneError);
            highlightCheckbox(termsCheckbox, false);
            highlightCheckbox(consentCheckbox, false);

            const rawName = nameInput.value;
            const rawPhone = phoneInput.value;
            const cleanedPhone = cleanPhoneNumber(rawPhone);

            let isValid = true;

            // Validate Name
            if (!validateName(rawName)) {
                showError(nameError, 'Name must contain only letters and spaces (minimum 2 characters).');
                isValid = false;
            }

            // Validate Phone Number
            if (!validatePhone(cleanedPhone)) {
                if (cleanedPhone.length !== 10) {
                    showError(phoneError, 'Please enter a valid 10-digit phone number.');
                } else if (!/^[6-9]/.test(cleanedPhone)) {
                    showError(phoneError, 'Phone number must start with 6, 7, 8, or 9.');
                } else if (/^(\d)\1{9}$/.test(cleanedPhone)) {
                    showError(phoneError, 'Please enter a valid phone number.');
                } else {
                    showError(phoneError, 'Please enter a valid Indian mobile number.');
                }
                isValid = false;
            }

            // Validate Terms Checkbox
            if (!termsCheckbox.checked) {
                highlightCheckbox(termsCheckbox, true);
                formStatus.textContent = 'Please agree to the Terms and Conditions.';
                formStatus.className = 'status-error';
                isValid = false;
            }

            // Validate Newsletter Consent Checkbox
            if (!consentCheckbox.checked) {
                highlightCheckbox(consentCheckbox, true);
                if (!formStatus.textContent) {
                    formStatus.textContent = 'Please confirm you want to receive the newsletter.';
                } else {
                    formStatus.textContent = 'Please check both consent boxes to continue.';
                }
                formStatus.className = 'status-error';
                isValid = false;
            }
            
            // Stop if validation failed
            if (!isValid) {
                if (!formStatus.textContent) {
                    formStatus.textContent = 'Please correct the errors above.';
                    formStatus.className = 'status-error';
                }
                return; 
            }

            // Check honeypot field (anti-spam)
            const honeypot = form.querySelector('[name="_gotcha"]');
            if (honeypot && honeypot.value) {
                // Bot detected - silently fail
                console.log('Bot detected via honeypot');
                return;
            }

            // Check submission timing (anti-bot)
            if (!checkSubmissionTiming()) {
                console.log('Submission too fast - likely bot');
                return;
            }

            // --- Submit Form to Google Sheets ---
            setButtonState(true);
            setFormInputsState(true);
            formStatus.textContent = 'Joining...';
            formStatus.className = 'status-loading';

            // Prepare form data with cleaned phone number for Google Sheets
            const formData = new URLSearchParams();
            formData.append('name', rawName.trim());
            formData.append('phone', cleanedPhone);
            formData.append('terms_agreement', termsCheckbox.value);
            formData.append('monthly_newsletter_consent', consentCheckbox.value);
            
            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });

                const result = await response.json();
                
                if (result.result === 'success') {
                    // Success
                    formStatus.textContent = '🎉 Welcome to GossipYah! Check WhatsApp for confirmation.';
                    formStatus.className = 'status-success';
                    form.reset();
                    autoClearStatus(8000);
                    
                    // Re-enable form after success
                    setFormInputsState(false);
                } else if (result.message && result.message.includes('already registered')) {
                    // Duplicate phone number
                    showError(phoneError, 'This phone number is already registered.');
                    formStatus.textContent = 'This phone number is already subscribed to our newsletter.';
                    formStatus.className = 'status-error';
                    setFormInputsState(false);
                } else {
                    // Other error from backend
                    formStatus.textContent = result.message || 'Something went wrong. Please try again.';
                    formStatus.className = 'status-error';
                    setFormInputsState(false);
                }
                
            } catch (error) {
                console.error('Form submission error:', error);
                
                // Network error - provide clear guidance
                formStatus.innerHTML = '❌ Unable to connect. Please check your internet connection or <a href="https://wa.me/7505323084" target="_blank" style="color: var(--color-gold); text-decoration: underline;">contact us via WhatsApp</a>.';
                formStatus.className = 'status-error';
                setFormInputsState(false);
            } finally {
                // Always re-enable button
                setButtonState(false);
            }
        });
    }

    // --- Real-time Validation (on blur) ---
    
    nameInput.addEventListener('blur', function() {
        if (nameInput.value && !validateName(nameInput.value)) {
            showError(nameError, 'Name must contain only letters and spaces.');
        } else {
            clearError(nameError);
        }
    });

    phoneInput.addEventListener('blur', function() {
        if (phoneInput.value) {
            const cleaned = cleanPhoneNumber(phoneInput.value);
            if (!validatePhone(cleaned)) {
                if (cleaned.length !== 10) {
                    showError(phoneError, 'Please enter a valid 10-digit phone number.');
                } else if (!/^[6-9]/.test(cleaned)) {
                    showError(phoneError, 'Phone number must start with 6, 7, 8, or 9.');
                } else {
                    showError(phoneError, 'Please enter a valid phone number.');
                }
            } else {
                clearError(phoneError);
            }
        }
    });

    // --- Input Event Handlers ---
    
    // Clear error messages when user starts typing
    nameInput.addEventListener('input', function() {
        if (nameError.textContent) {
            clearError(nameError);
        }
    });

    phoneInput.addEventListener('input', function() {
        if (phoneError.textContent) {
            clearError(phoneError);
        }
        // Allow only digits, spaces, hyphens, and parentheses for user convenience
        // These will be stripped before validation
        this.value = this.value.replace(/[^\d\s\-\(\)]/g, '');
    });

    // Clear checkbox error styling when checked
    termsCheckbox.addEventListener('change', function() {
        if (this.checked) {
            highlightCheckbox(this, false);
        }
    });

    consentCheckbox.addEventListener('change', function() {
        if (this.checked) {
            highlightCheckbox(this, false);
        }
    });
});