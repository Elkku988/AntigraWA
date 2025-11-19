// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Check for saved user preference, if any, on load of the website
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            themeToggle.textContent = 'Light Mode';
        }
    }

    // Add event listener to the button
    themeToggle.addEventListener('click', () => {
        // Toggle the 'dark-mode' class on the body
        body.classList.toggle('dark-mode');

        // Update button text and save preference
        if (body.classList.contains('dark-mode')) {
            themeToggle.textContent = 'Light Mode';
            localStorage.setItem('theme', 'dark-mode');
        } else {
            themeToggle.textContent = 'Dark Mode';
            localStorage.setItem('theme', '');
        }
    });

    console.log("Welcome to your first website! Check out the code to see how this works.");
});
