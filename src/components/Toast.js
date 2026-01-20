import { animate } from "motion";

export const Toast = {
  container: null,
  init() {
    if (this.container) return;

    const style = document.createElement("style");
    style.textContent = `
      .toast-container {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      }

      .toast-cable {
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
      }

      /* The cable wire */
      .toast-wire {
        width: 3px;
        height: 0;
        background: linear-gradient(180deg,
          #2a2a2a 0%,
          #3d3d3d 50%,
          #2a2a2a 100%
        );
        border-radius: 2px;
        box-shadow: inset 1px 0 0 rgba(255,255,255,0.1);
      }

      /* Jack connector top */
      .toast-jack {
        width: 14px;
        height: 8px;
        background: linear-gradient(180deg, #555 0%, #333 100%);
        border-radius: 2px 2px 0 0;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.2),
          0 1px 2px rgba(0,0,0,0.3);
      }

      /* The message body - like a cable label/tag */
      .toast-body {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: linear-gradient(180deg, #4a4a4a 0%, #3d3d3d 50%, #333 100%);
        border: 1px solid #555;
        border-radius: 6px;
        box-shadow:
          0 4px 12px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.1),
          0 1px 0 rgba(255,255,255,0.05);
        opacity: 0;
        transform: translateY(-30px) scale(0.95);
      }

      /* LED indicator dot */
      .toast-led {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow:
          inset 0 -2px 4px rgba(0,0,0,0.4),
          0 0 8px currentColor;
        animation: led-pulse 1.5s ease-in-out infinite;
      }

      @keyframes led-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .toast-led-success {
        background: radial-gradient(circle at 30% 30%, #4ade80, #22c55e);
        color: #22c55e;
      }

      .toast-led-error {
        background: radial-gradient(circle at 30% 30%, #f87171, #dc2626);
        color: #dc2626;
      }

      .toast-led-warning {
        background: radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b);
        color: #f59e0b;
      }

      .toast-led-info {
        background: radial-gradient(circle at 30% 30%, #60a5fa, #3b82f6);
        color: #3b82f6;
      }

      /* Message text - LCD style */
      .toast-text {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        font-weight: 600;
        color: #e0e0e0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Type-specific accent colors on border */
      .toast-body-success {
        border-color: #22c55e;
        border-left: 3px solid #22c55e;
      }

      .toast-body-error {
        border-color: #dc2626;
        border-left: 3px solid #dc2626;
      }

      .toast-body-warning {
        border-color: #f59e0b;
        border-left: 3px solid #f59e0b;
      }

      .toast-body-info {
        border-color: #3b82f6;
        border-left: 3px solid #3b82f6;
      }
    `;
    document.head.appendChild(style);

    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  },

  show(message, type = "info") {
    if (!this.container) this.init();

    // Create cable structure
    const cable = document.createElement("div");
    cable.className = "toast-cable";

    cable.innerHTML = `
      <div class="toast-jack"></div>
      <div class="toast-wire"></div>
      <div class="toast-body toast-body-${type}">
        <div class="toast-led toast-led-${type}"></div>
        <span class="toast-text">${message}</span>
      </div>
    `;

    this.container.appendChild(cable);

    const wire = cable.querySelector(".toast-wire");
    const body = cable.querySelector(".toast-body");
    const jack = cable.querySelector(".toast-jack");

    // Entry animation - gentle spring, like cable being lowered
    animate(
      wire,
      { height: "24px" },
      {
        type: "spring",
        stiffness: 120,
        damping: 20,
        mass: 1,
      }
    );

    animate(
      body,
      {
        opacity: 1,
        y: 0,
        scale: 1,
      },
      {
        type: "spring",
        stiffness: 100,
        damping: 18,
        mass: 1.2,
        delay: 0.1,
      }
    );

    // Remove after delay with yank animation
    setTimeout(() => {
      // Exit animation - fast violent yank
      animate(
        body,
        {
          opacity: 0,
          y: -80,
          scale: 0.8,
        },
        {
          type: "spring",
          stiffness: 800,
          damping: 15,
          mass: 0.5,
        }
      );

      animate(
        wire,
        { height: "0px" },
        {
          type: "spring",
          stiffness: 900,
          damping: 12,
          mass: 0.3,
        }
      );

      animate(
        jack,
        { y: [0, -6, 0] },
        {
          type: "spring",
          stiffness: 600,
          damping: 10,
          mass: 0.4,
        }
      );

      setTimeout(() => cable.remove(), 200);
    }, 3000);
  },
};
