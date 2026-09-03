export const CelestialOrrery = () => {
  return (
    <div className="celestial-orrery-wrapper absolute inset-0 overflow-hidden pointer-events-none">
      <div className="glyph-field">
        <div className="glyph-container glyph-1">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
          <div className="glyph-part part-3"></div>
        </div>
        <div className="glyph-container glyph-2">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
        </div>
        <div className="glyph-container glyph-3">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
          <div className="glyph-part part-3"></div>
        </div>
      </div>

      <div className="orrery-field">
        <div className="orbit orbit-1">
          <div className="planet"></div>
        </div>
        <div className="orbit orbit-2">
          <div className="planet"></div>
        </div>
        <div className="orbit orbit-3">
          <div className="planet"></div>
        </div>
        <div className="orbit orbit-4">
          <div className="planet"></div>
        </div>
      </div>
    </div>
  );
};
