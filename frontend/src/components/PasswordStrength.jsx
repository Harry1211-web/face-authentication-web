import React from 'react';

export default function PasswordStrength({ password }) {
  const requirements = [
    { label: "Ít nhất 8 ký tự", regex: /.{8,}/ },
    { label: "Chữ cái viết hoa (A-Z)", regex: /[A-Z]/ },
    { label: "Chữ cái viết thường (a-z)", regex: /[a-z]/ },
    { label: "Chữ số (0-9)", regex: /\d/ },
    { label: "Ký tự đặc biệt (!@#$%, v.v.)", regex: /[^A-Za-z0-9]/ }
  ];

  if (!password) return null;

  return (
    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Độ mạnh mật khẩu:</div>
      <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
        {requirements.map((req, index) => {
          const isValid = req.regex.test(password);
          return (
            <li 
              key={index} 
              style={{ 
                color: isValid ? '#2e7d32' : '#d32f2f',
                display: 'flex',
                alignItems: 'center',
                marginBottom: '4px'
              }}
            >
              <span style={{ marginRight: '8px', fontSize: '1rem' }}>
                {isValid ? '✓' : '✗'}
              </span>
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
