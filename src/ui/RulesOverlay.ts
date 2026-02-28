export function showRules(): void {
  const overlay = document.createElement("div");
  overlay.className = "rules-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const panel = document.createElement("div");
  panel.className = "rules-panel";
  panel.innerHTML = `
    <div class="settings-header">
      <h2>RULES</h2>
      <button class="settings-close rules-close">X</button>
    </div>
    <div class="rules-body">
      <p class="rules-section">GOAL</p>
      <p>Race downhill as fast as you can. Your time is your score.</p>
      <p class="rules-section">COINS</p>
      <p>Collect gold coins on the slope. Spend them in the <span class="rules-hl">SHOP</span> to upgrade your gear.</p>
      <p class="rules-section">GEAR</p>
      <p><span class="rules-hl">Skis</span> &mdash; higher top speed + tighter turns</p>
      <p><span class="rules-hl">Boots</span> &mdash; faster crash recovery</p>
      <p><span class="rules-hl">Jacket</span> &mdash; keep more speed on crash</p>
      <p class="rules-section">MOVEMENT</p>
      <p>Hold <span class="rules-hl">W</span> to go faster. What happens depends on your speed:</p>
      <p><span class="rules-hl">Stopped / Slow</span> &mdash; Skate + pole (V-step waddle with pole push)</p>
      <p><span class="rules-hl">Medium</span> &mdash; Double pole (arms pump for speed)</p>
      <p><span class="rules-hl">Fast</span> &mdash; Tuck (crouch for less drag)</p>
      <p>Use this to get unstuck if you slow down on a flat or hill!</p>
      <p class="rules-section">TRICKS</p>
      <p>Jump off ridges and perform tricks while airborne for bonus points:</p>
      <p><span class="rules-hl">Spin</span> &mdash; Steer (A/D) while airborne</p>
      <p><span class="rules-hl">Grab</span> &mdash; Tuck (W) while airborne</p>
      <p><span class="rules-hl">Flip</span> &mdash; Brake (S) while airborne</p>
      <p>Combine multiple tricks in one jump for a combo multiplier. Build your <span class="rules-hl">Flow</span> meter by skiing cleanly to multiply all trick scores.</p>
      <p class="rules-section">HAZARDS</p>
      <p>Rocks and stumps cause stumbles or wipeouts. Avoid them or upgrade your gear to reduce the penalty.</p>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));

  function close() {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 300);
  }

  panel.querySelector(".rules-close")!.addEventListener("click", close);
}
