function LanguageSelector({ language, onChange }) {
  return (
    <select
      value={language}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '6px 10px',
        borderRadius: '20px',
        border: '1px solid #C9A46B',
        backgroundColor: '#fff',
        color: '#5A4632',
        fontSize: '0.9em',
        cursor: 'pointer'
      }}
    >
      <option value="en">English</option>
      <option value="hi">हिंदी</option>
    </select>
  );
}

export default LanguageSelector;