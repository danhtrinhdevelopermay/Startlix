import { useEffect, useRef } from 'react';

export default function GradientBackground() {
  const particlesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const particlesContainer = particlesContainerRef.current;
    if (!particlesContainer) return;

    const particleCount = 80;
    
    // Clear existing particles
    particlesContainer.innerHTML = '';
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
      createParticle();
    }
    
    function createParticle() {
      if (!particlesContainer) return;
      
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random size (small)
      const size = Math.random() * 3 + 1;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Random initial position
      const initialX = Math.random() * window.innerWidth;
      const drift = (Math.random() - 0.5) * 200; // Random horizontal drift
      
      particle.style.left = `${initialX}px`;
      particle.style.setProperty('--particle-drift', `${drift}px`);
      
      // Random animation delay
      const delay = Math.random() * 15;
      particle.style.animationDelay = `-${delay}s`;
      
      particlesContainer.appendChild(particle);
    }
    
    // Clean up function
    return () => {
      if (particlesContainer) {
        particlesContainer.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="gradient-background">
      <div className="gradient-sphere sphere-1"></div>
      <div className="gradient-sphere sphere-2"></div>
      <div className="gradient-sphere sphere-3"></div>
      <div className="glow"></div>
      <div className="grid-overlay"></div>
      <div className="noise-overlay"></div>
      <div 
        className="particles-container" 
        ref={particlesContainerRef}
      ></div>
    </div>
  );
}