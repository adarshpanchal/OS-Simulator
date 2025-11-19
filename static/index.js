// Placeholder for future dashboard interactions
document.addEventListener('DOMContentLoaded', () => {
    // Fade-in animation for cards
    document.querySelectorAll('.card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(6px)';
        setTimeout(() => {
            card.style.transition = 'opacity .35s ease, transform .35s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 60 * i);
    });
});

