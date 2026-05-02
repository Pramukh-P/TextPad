import "./loader.css";

export default function Loader() {
  return (
    <div className="loader-container">
      <div className="loader-icon">
        <div className="leaf leaf-1"></div>
        <div className="leaf leaf-2"></div>
        <div className="leaf leaf-3"></div>
      </div>
      <p className="loader-text">Loading your pad...</p>
    </div>
  );
}
