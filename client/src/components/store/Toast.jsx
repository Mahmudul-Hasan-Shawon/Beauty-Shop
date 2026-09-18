import React from 'react';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast-host">
      <div className={`toast ${toast.type === 'info' ? 'info' : ''}`}>
        {toast.msg}
      </div>
    </div>
  );
}