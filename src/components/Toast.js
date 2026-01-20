export const Toast = {
  container: null,
  init() {
    if (this.container) return; //already initialized

    const style = document.createElement("style");
    style.textContent = `
        .toast-container{
        position: fixed;
        top:20px;
        left:50%;
        transform: translateX(-50%);
        z-index:9999;
        display:flex;
        flex-direction:columnl
        gap:8px;
        }

        .toastMessage {
        padding:12px 24px;
        border-radisu:6px;
        color:white;
        font-size:14px;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .toastMessage.visible {
            opacity:1;
            transform: translateY(0);
        }

        .toastMessage-info {                                                                                                                                      
              background: #3b82f6;                                                                                                                                  
          }                                                                                                                                                         
                                                                                                                                                                    
          .toastMessage-success {                                                                                                                                   
              background: #22c55e;                                                                                                                                  
          }                                                                                                                                                         
                                                                                                                                                                    
          .toastMessage-error {                                                                                                                                     
              background: #ef4444;                                                                                                                                  
          }                                                                                                                                                         
                                                                                                                                                                    
          .toastMessage-warning {                                                                                                                                   
              background: #f59e0b;                                                                                                                                  
          }  
        `;
    document.head.appendChild(style);

    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  },
  show(message, type = "info") {
    if (!this.container) this.init();
    const div = document.createElement("div");
    div.className = `toastMessage toastMessage-${type}`;
    div.textContent = message;
    this.container.appendChild(div);

    requestAnimationFrame(() => {
      div.classList.add("visible");
    });

    setTimeout(() => {
      div.classList.remove("visible");
      setTimeout(
        () => div.remove(),
        300, // Wait for fade-out animation
      );
    }, 3000);
  },
};
