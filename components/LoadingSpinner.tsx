
import React from 'react';

const LoadingSpinner = ({ size = 'w-5 h-5' }: { size?: string }) => (
  <div
    className={`${size} animate-spin rounded-full border-2 border-current border-t-transparent`}
    role="status"
    aria-live="polite"
  >
    <span className="sr-only">Loading...</span>
  </div>
);

export default LoadingSpinner;
