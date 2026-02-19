/**
 * Gun Controller for Pixel Shooting Range
 * Handles pistol movement, crosshair tracking, and target highlighting
 */

const GunController = {
    pistol: null,
    crosshair: null,
    
    config: {
        maxShiftX: 40,
        maxShiftY: 20,
        maxRotation: 18
    },

    init() {
        this.pistol = document.getElementById('pistol');
        this.crosshair = document.getElementById('crosshair');
        
        if (!this.pistol || !this.crosshair) {
            console.warn('[GunController] Missing pistol or crosshair element');
            return;
        }
        
        this.bindEvents();
        this.initCrosshairVisibility();
    },

    bindEvents() {
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseenter', () => this.showCrosshair());
        document.addEventListener('mouseleave', () => this.hideCrosshair());
        
        this.bindSignHoverEvents();
    },

    bindSignHoverEvents() {
        const signs = document.querySelectorAll('.sign-btn');
        
        signs.forEach(sign => {
            sign.addEventListener('mouseenter', () => this.setTargetMode(true));
            sign.addEventListener('mouseleave', () => this.setTargetMode(false));
        });
    },

    handleMouseMove(e) {
        this.updatePistol(e.clientX, e.clientY);
        this.updateCrosshair(e.clientX, e.clientY);
    },

    updatePistol(mouseX, mouseY) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight;
        
        const deltaX = mouseX - centerX;
        const deltaY = centerY - mouseY;
        
        const angle = Math.atan2(deltaX, deltaY) * (180 / Math.PI);
        const rotation = angle * 0.5;
        const clampedRotation = Math.max(-this.config.maxRotation, Math.min(this.config.maxRotation, rotation));
        
        const normalizedX = deltaX / centerX;
        const offsetX = normalizedX * this.config.maxShiftX;
        const offsetY = (mouseY / window.innerHeight) * this.config.maxShiftY;
        
        this.pistol.style.transform = `translateX(calc(-50% + ${offsetX}px)) translateY(${-offsetY}px) rotate(${clampedRotation}deg)`;
    },

    updateCrosshair(mouseX, mouseY) {
        this.crosshair.style.left = mouseX + 'px';
        this.crosshair.style.top = mouseY + 'px';
    },

    setTargetMode(isOverTarget) {
        if (isOverTarget) {
            this.crosshair.classList.add('crosshair-target');
        } else {
            this.crosshair.classList.remove('crosshair-target');
        }
    },

    showCrosshair() {
        this.crosshair.style.opacity = '1';
    },

    hideCrosshair() {
        this.crosshair.style.opacity = '0';
    },

    initCrosshairVisibility() {
        this.crosshair.style.opacity = '1';
    }
};
