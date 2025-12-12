// src/CardSlider.js

import React, { useState } from 'react';

function CardSlider() {
  // 카드 데이터 (0부터 7까지)
  const [activeIndex, setActiveIndex] = useState(2); 
  const items = [0, 1, 2, 3, 4, 5, 6, 7]; 

  // 카드에 적용될 CSS 클래스를 계산하는 로직
  const getCardClass = (index) => {
    const length = items.length;
    let diff = index - activeIndex;

    // 순환 처리: 끝에서 처음으로 이어지게
    if (diff > length / 2) diff -= length;
    if (diff < -length / 2) diff += length;

    if (diff === 0) return 'card-item active';
    if (diff === -1) return 'card-item prev';
    if (diff === 1) return 'card-item next';
    if (diff < -1) return 'card-item hide-left';
    return 'card-item hide-right';
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div className="gallery-container">
      <ul className="cards-list">
        {items.map((item, index) => (
          <li key={index} className={getCardClass(index)}>
            {item}
          </li>
        ))}
      </ul>
      <div className="slider-actions">
        <button className="slider-btn" onClick={handlePrev}>PREV</button>
        <button className="slider-btn next" onClick={handleNext}>NEXT</button>
      </div>
    </div>
  );
}

export default CardSlider;