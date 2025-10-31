// src/components/LoadingSpinner.jsx
import React from 'react';

function LoadingSpinner() {
  return (
    <section className="hero is-fullheight">
      <div className="hero-body has-text-centered is-justify-content-center">
        {/* Bulma's loader element */}
        <div className="loader is-large"></div>
      </div>
    </section>
  );
}

export default LoadingSpinner;