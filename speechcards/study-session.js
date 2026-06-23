/**
 * study-session.js - SpeechCards Study View Component
 * Renders the swipeable card stack, stopwatch, and speech memorization helpers.
 */

(function() {
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo } = React;

  // Stable word counts
  const getWordCount = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    const text = temp.textContent || temp.innerText || "";
    const matches = text.match(/[a-zA-Z0-9']+/g);
    return matches ? matches.length : 0;
  };

  // Convert HTML text to First Letters Only
  function convertToFirstLettersHTML(html) {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = node.nodeValue.replace(/[a-zA-Z0-9']+/g, (word) => {
          if (word.length <= 1) return word;
          return word[0] + '.'.repeat(word.length - 1);
        });
      } else {
        const children = Array.from(node.childNodes);
        children.forEach(child => walk(child));
      }
    }
    
    walk(tempDiv);
    return tempDiv.innerHTML;
  }

  // Mask words stably
  function maskRandomWordsHTML(html, percentage) {
    if (!html || percentage === 0) return html;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let wordCounter = 0;
    
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        const tokens = text.split(/(\s+|[,.;:!?()"'“”’\-—])/g);
        const fragment = document.createDocumentFragment();
        
        tokens.forEach(token => {
          if (!token) return;
          const isWord = /^[a-zA-Z0-9']+$/.test(token);
          if (isWord) {
            wordCounter++;
            // Stable hash based on word counter to pick words to hide
            const rand = (Math.sin(wordCounter * 12.9898) * 43758.5453) % 1;
            const positiveRand = Math.abs(rand);
            
            if (positiveRand < percentage / 100) {
              const span = document.createElement('span');
              span.className = 'masked-word';
              span.textContent = token;
              span.setAttribute('onclick', "this.classList.toggle('revealed')");
              fragment.appendChild(span);
            } else {
              fragment.appendChild(document.createTextNode(token));
            }
          } else {
            fragment.appendChild(document.createTextNode(token));
          }
        });
        
        node.parentNode.replaceChild(fragment, node);
      } else {
        const children = Array.from(node.childNodes);
        children.forEach(child => walk(child));
      }
    }
    
    walk(tempDiv);
    return tempDiv.innerHTML;
  }

  // Fisher-Yates shuffle helper
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function StudySession({ deck, onClose, presentationMode = false }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(presentationMode);
    
    // Settings
    const [shuffle, setShuffle] = useState(false);
    const [filter, setFilter] = useState('all'); // all | needsReview | unmastered
    
    // Memorization Helpers
    const [firstLettersMode, setFirstLettersMode] = useState(false);
    const [wordHidePercent, setWordHidePercent] = useState(0);
    
    // Stopwatch State
    const [timerActive, setTimerActive] = useState(false);
    const [time, setTime] = useState(0); // in deciseconds (100ms blocks)
    const stopwatchInterval = useRef(null);

    // Gestures Drag references
    const cardRef = useRef(null);
    const dragOverlayNextRef = useRef(null);
    const dragOverlayPrevRef = useRef(null);
    
    const dragStart = useRef({ x: 0, y: 0, time: 0 });
    const isDragging = useRef(false);

    // Force flipped state if presentationMode changes
    useEffect(() => {
      setFlipped(presentationMode);
    }, [presentationMode]);

    // Compute cards to study based on shuffle and filters
    const cardsToStudy = useMemo(() => {
      let list = deck.cards || [];
      
      if (filter === 'needsReview') {
        list = list.filter(c => c.needsReview);
      } else if (filter === 'unmastered') {
        list = list.filter(c => !c.mastered);
      }
      
      if (shuffle) {
        list = shuffleArray(list);
      }
      
      return list;
    }, [deck.cards, shuffle, filter]);

    // Bounds check current index
    useEffect(() => {
      if (currentIndex >= cardsToStudy.length && cardsToStudy.length > 0) {
        setCurrentIndex(cardsToStudy.length - 1);
      }
    }, [cardsToStudy, currentIndex]);

    const activeCard = cardsToStudy[currentIndex] || null;

    // Reset card flipped state when index changes (only in practice mode)
    useEffect(() => {
      if (!presentationMode) {
        setFlipped(false);
      }
      resetStopwatch();
    }, [currentIndex]);

    // Stopwatch Controls
    useEffect(() => {
      if (timerActive) {
        const startTimestamp = Date.now() - (time * 100);
        stopwatchInterval.current = setInterval(() => {
          setTime(Math.floor((Date.now() - startTimestamp) / 100));
        }, 100);
      } else {
        if (stopwatchInterval.current) {
          clearInterval(stopwatchInterval.current);
        }
      }
      return () => {
        if (stopwatchInterval.current) clearInterval(stopwatchInterval.current);
      };
    }, [timerActive]);

    const toggleStopwatch = (e) => {
      if (e) e.stopPropagation();
      setTimerActive(!timerActive);
    };

    const resetStopwatch = (e) => {
      if (e) e.stopPropagation();
      setTimerActive(false);
      setTime(0);
    };

    const formatTime = (t) => {
      const mins = Math.floor(t / 600);
      const secs = Math.floor((t % 600) / 10);
      const dsecs = t % 10;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${dsecs}`;
    };

    // Calculate delivery Speed metrics
    const wpmMetrics = useMemo(() => {
      if (!activeCard || time === 0) return null;
      const wordCount = getWordCount(activeCard.back);
      const minutes = (time * 100) / 60000;
      const wpm = Math.round(wordCount / minutes);
      
      let evaluation = "";
      let colorClass = "";
      if (wpm < 110) {
        evaluation = "Slow and steady. Good for emphasis!";
        colorClass = "var(--text-secondary)";
      } else if (wpm >= 110 && wpm <= 135) {
        evaluation = "Clear, measured pace. Excellent!";
        colorClass = "var(--color-success)";
      } else if (wpm > 135 && wpm <= 165) {
        evaluation = "Standard conversational pace. Good!";
        colorClass = "var(--color-accent)";
      } else if (wpm > 165 && wpm <= 190) {
        evaluation = "Fast speaking pace. Make sure to enunciate.";
        colorClass = "var(--color-warning)";
      } else {
        evaluation = "Very rushed. Slow down and breathe!";
        colorClass = "var(--color-danger)";
      }
      
      return { wpm, evaluation, colorClass };
    }, [activeCard, time]);

    // Handle marking card progress
    const markCard = (masteredStatus, needsReviewStatus) => {
      if (!activeCard) return;
      
      const updatedCards = deck.cards.map(c => {
        if (c.id === activeCard.id) {
          return { ...c, mastered: masteredStatus, needsReview: needsReviewStatus };
        }
        return c;
      });
      
      window.SpeechDB.saveDeck({ ...deck, cards: updatedCards });
      
      // Advance to next card
      handleNext();
    };

    const handleNext = () => {
      if (currentIndex < cardsToStudy.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCurrentIndex(0);
      }
    };

    const handlePrev = () => {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else {
        setCurrentIndex(cardsToStudy.length - 1);
      }
    };

    // Card Swipe Gesture Physics
    const handleDragStart = (clientX, clientY) => {
      dragStart.current = { x: clientX, y: clientY, time: Date.now() };
      isDragging.current = true;
      if (cardRef.current) {
        cardRef.current.style.transition = 'none';
      }
    };

    const handleDragMove = (clientX, clientY) => {
      if (!isDragging.current || !cardRef.current) return;
      
      const deltaX = clientX - dragStart.current.x;
      const deltaY = clientY - dragStart.current.y;
      const rotation = deltaX / 15;
      
      cardRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
      
      if (deltaX < -30) {
        if (dragOverlayNextRef.current) dragOverlayNextRef.current.style.opacity = Math.min(Math.abs(deltaX) / 100, 1);
        if (dragOverlayPrevRef.current) dragOverlayPrevRef.current.style.opacity = 0;
      } else if (deltaX > 30) {
        if (dragOverlayPrevRef.current) dragOverlayPrevRef.current.style.opacity = Math.min(deltaX / 100, 1);
        if (dragOverlayNextRef.current) dragOverlayNextRef.current.style.opacity = 0;
      } else {
        if (dragOverlayNextRef.current) dragOverlayNextRef.current.style.opacity = 0;
        if (dragOverlayPrevRef.current) dragOverlayPrevRef.current.style.opacity = 0;
      }
    };

    const handleDragEnd = (clientX) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      
      const deltaX = clientX - dragStart.current.x;
      const duration = Date.now() - dragStart.current.time;
      const velocity = Math.abs(deltaX) / duration;
      
      const swipeThreshold = 120;
      const velocityThreshold = 0.5;

      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      }
      
      if (dragOverlayNextRef.current) dragOverlayNextRef.current.style.opacity = 0;
      if (dragOverlayPrevRef.current) dragOverlayPrevRef.current.style.opacity = 0;

      if (deltaX < -swipeThreshold || (deltaX < -40 && velocity > velocityThreshold)) {
        if (cardRef.current) {
          cardRef.current.style.transform = `translate(-150%, 0) rotate(-25deg)`;
        }
        setTimeout(() => {
          handleNext();
          if (cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.transform = `translate(150%, 0) rotate(25deg)`;
            cardRef.current.offsetHeight;
            cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            cardRef.current.style.transform = `translate(0, 0) rotate(0deg)`;
          }
        }, 150);
      } else if (deltaX > swipeThreshold || (deltaX > 40 && velocity > velocityThreshold)) {
        if (cardRef.current) {
          cardRef.current.style.transform = `translate(150%, 0) rotate(25deg)`;
        }
        setTimeout(() => {
          handlePrev();
          if (cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.transform = `translate(-150%, 0) rotate(-25deg)`;
            cardRef.current.offsetHeight;
            cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            cardRef.current.style.transform = `translate(0, 0) rotate(0deg)`;
          }
        }, 150);
      } else {
        if (cardRef.current) {
          cardRef.current.style.transform = `translate(0, 0) rotate(0deg)`;
        }
      }
    };

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          if (!presentationMode) setFlipped(f => !f);
        } else if (e.code === 'ArrowLeft') {
          handlePrev();
        } else if (e.code === 'ArrowRight') {
          handleNext();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cardsToStudy, currentIndex, presentationMode]);

    const processedBackHTML = useMemo(() => {
      if (!activeCard) return '';
      let html = activeCard.back;
      
      if (firstLettersMode) {
        html = convertToFirstLettersHTML(html);
      }
      
      if (wordHidePercent > 0) {
        html = maskRandomWordsHTML(html, wordHidePercent);
      }
      
      return html;
    }, [activeCard, firstLettersMode, wordHidePercent]);

    // Bounds Check Render
    if (cardsToStudy.length === 0) {
      return h('div', { className: 'study-view glass-panel', style: { padding: '3rem', textAlign: 'center' } },
        h('h3', { style: { marginBottom: '1rem', fontSize: '1.5rem' } }, 'No Cards to Present'),
        h('p', { style: { color: 'var(--text-secondary)', marginBottom: '2rem' } }, 'Add sections to your speech inside the editor to present it.'),
        h('button', { className: 'btn btn-primary', onClick: onClose }, 'Return')
      );
    }

    // 1. PRESENTATION MODE RENDER
    if (presentationMode) {
      return h('div', { className: 'presentation-view' },
        // Top glowing progress bar line
        h('div', {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            height: '4px',
            background: 'linear-gradient(to right, var(--color-primary), var(--color-accent))',
            width: `${((currentIndex + 1) / cardsToStudy.length) * 100}%`,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1001
          }
        }),

        // Floating Exit
        h('button', { className: 'presentation-exit-btn', onClick: onClose, title: 'Exit Presentation' },
          h('i', { className: 'fas fa-times' })
        ),

        // Stack Container
        h('div', {
          className: 'card-stack-container presentation-card-container',
          onTouchStart: (e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY),
          onTouchMove: (e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY),
          onTouchEnd: (e) => handleDragEnd(e.changedTouches[0].clientX),
          onMouseDown: (e) => handleDragStart(e.clientX, e.clientY),
          onMouseMove: (e) => handleDragMove(e.clientX, e.clientY),
          onMouseUp: (e) => handleDragEnd(e.clientX),
          onMouseLeave: () => {
            if (isDragging.current) {
              isDragging.current = false;
              if (cardRef.current) cardRef.current.style.transform = `translate(0, 0) rotate(0deg)`;
              if (dragOverlayNextRef.current) dragOverlayNextRef.current.style.opacity = 0;
              if (dragOverlayPrevRef.current) dragOverlayPrevRef.current.style.opacity = 0;
            }
          }
        },
          h('div', { ref: dragOverlayNextRef, className: 'swipe-overlay swipe-overlay-next' }, 'Next ➔'),
          h('div', { ref: dragOverlayPrevRef, className: 'swipe-overlay swipe-overlay-prev' }, '← Prev'),

          activeCard && h('div', {
            ref: cardRef,
            className: 'flashcard presentation-card',
            style: { cursor: 'grab' }
          },
            h('div', { 
              className: 'card-face card-back presentation-card-face',
              style: { transform: 'none' } // absolute layout to keep container bounds
            },
              h('div', { className: 'card-label', style: { marginBottom: '1rem' } }, `${deck.title} — Section ${currentIndex + 1} of ${cardsToStudy.length}`),
              h('div', {
                className: 'card-content-text',
                dangerouslySetInnerHTML: { __html: activeCard.back || 'No content' }
              })
            )
          )
        ),

        // Bottom progress indicator section (dots + page numbers)
        h('div', {
          style: {
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            zIndex: 100
          }
        },
          h('div', {
            style: {
              fontSize: '1rem',
              fontWeight: '700',
              color: 'var(--text-secondary)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              border: '1px solid var(--panel-border)'
            }
          }, `${currentIndex + 1} / ${cardsToStudy.length}`),
          h('div', { style: { display: 'flex', gap: '0.35rem' } },
            cardsToStudy.map((_, idx) => h('div', {
              key: idx,
              style: {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: idx === currentIndex ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.15)',
                transition: 'all 0.3s ease',
                boxShadow: idx === currentIndex ? '0 0 8px var(--color-primary)' : 'none'
              }
            }))
          )
        )
      );
    }

    // 2. STANDARD STUDY/PRACTICE MODE RENDER
    return h('div', { className: 'study-view' },
      h('div', { className: 'study-header' },
        h('button', { className: 'btn btn-secondary btn-icon', onClick: onClose, title: 'Exit Practice' }, 
          h('i', { className: 'fas fa-arrow-left' })
        ),
        h('div', { className: 'study-progress-container' },
          h('div', { className: 'study-progress-nums' },
            h('span', null, `Card ${currentIndex + 1} of ${cardsToStudy.length}`),
            h('span', null, `${Math.round(((currentIndex + 1) / cardsToStudy.length) * 100)}%`)
          ),
          h('div', { className: 'study-progress-bar-bg' },
            h('div', { 
              className: 'study-progress-bar-fill', 
              style: { width: `${((currentIndex + 1) / cardsToStudy.length) * 100}%` } 
            })
          )
        ),
        h('div', { style: { display: 'flex', gap: '0.5rem' } },
          h('button', {
            className: 'btn btn-secondary btn-icon' + (shuffle ? ' btn-primary' : ''),
            title: 'Shuffle Cards',
            onClick: () => setShuffle(!shuffle)
          }, h('i', { className: 'fas fa-random' })),
          
          h('select', {
            value: filter,
            onChange: (e) => setFilter(e.target.value),
            style: {
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'white',
              border: '1px solid var(--panel-border)',
              borderRadius: '0.75rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.85rem',
              outline: 'none'
            }
          },
            h('option', { value: 'all' }, 'All Cards'),
            h('option', { value: 'needsReview' }, 'Needs Review'),
            h('option', { value: 'unmastered' }, 'Unmastered')
          )
        )
      ),

      h('div', { 
        className: 'card-stack-container',
        onTouchStart: (e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY),
        onTouchMove: (e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY),
        onTouchEnd: (e) => handleDragEnd(e.changedTouches[0].clientX),
        onMouseDown: (e) => handleDragStart(e.clientX, e.clientY),
        onMouseMove: (e) => handleDragMove(e.clientX, e.clientY),
        onMouseUp: (e) => handleDragEnd(e.clientX),
        onMouseLeave: () => {
          if (isDragging.current) {
            isDragging.current = false;
            if (cardRef.current) cardRef.current.style.transform = `translate(0, 0) rotate(0deg)`;
            if (dragOverlayNextRef.current) dragOverlayNextRef.current.style.opacity = 0;
            if (dragOverlayPrevRef.current) dragOverlayPrevRef.current.style.opacity = 0;
          }
        }
      },
        h('div', { ref: dragOverlayNextRef, className: 'swipe-overlay swipe-overlay-next' }, 'Next ➔'),
        h('div', { ref: dragOverlayPrevRef, className: 'swipe-overlay swipe-overlay-prev' }, '← Prev'),

        activeCard && h('div', { 
          ref: cardRef,
          className: 'flashcard' + (flipped ? ' flipped' : ''),
          onClick: () => setFlipped(!flipped)
        },
          h('div', { className: 'card-inner' },
            h('div', { className: 'card-face card-front' },
              h('div', { className: 'card-label' }, `CUE CARD - ${activeCard.title || 'Untitled'}`),
              h('div', { 
                className: 'card-content-text', 
                dangerouslySetInnerHTML: { __html: activeCard.front || 'Tap to reveal back' } 
              }),
              h('div', { className: 'card-hint-reveal' }, 'Tap Spacebar or Click to reveal speech')
            ),
            
            h('div', { className: 'card-face card-back' },
              h('div', { className: 'card-label' }, `SPEECH SECTION - ${activeCard.title || 'Untitled'}`),
              h('div', { 
                className: 'card-content-text',
                dangerouslySetInnerHTML: { __html: processedBackHTML || 'Empty back content' }
              }),
              h('div', { className: 'card-hint-reveal' }, 'Tap Spacebar or Click to flip back')
            )
          )
        )
      ),

      h('div', { className: 'speech-toolkit glass-panel' },
        h('div', { className: 'toolkit-row' },
          h('div', { className: 'toolkit-group' },
            h('span', { className: 'toolkit-label' }, 'First Letters Only'),
            h('label', { className: 'switch' },
              h('input', {
                type: 'checkbox',
                checked: firstLettersMode,
                onChange: (e) => setFirstLettersMode(e.target.checked)
              }),
              h('span', { className: 'slider' })
            ),
            h('div', { style: { width: 10 } }),
            h('span', { className: 'toolkit-label' }, 'Hide Words:'),
            h('input', {
              type: 'range',
              className: 'slider-control',
              min: '0',
              max: '90',
              step: '10',
              value: wordHidePercent,
              onChange: (e) => setWordHidePercent(parseInt(e.target.value))
            }),
            h('span', { className: 'toolkit-label', style: { width: '30px', textAlign: 'right' } }, `${wordHidePercent}%`)
          ),

          h('div', { className: 'wpm-stopwatch' },
            h('button', { 
              className: 'btn btn-secondary btn-icon', 
              style: { width: '2rem', height: '2rem' },
              onClick: toggleStopwatch 
            }, 
              h('i', { className: timerActive ? 'fas fa-pause' : 'fas fa-play' })
            ),
            h('span', { className: 'stopwatch-time' }, formatTime(time)),
            h('button', { 
              className: 'btn btn-secondary btn-icon', 
              style: { width: '2rem', height: '2rem' },
              onClick: resetStopwatch 
            }, 
              h('i', { className: 'fas fa-redo' })
            ),
            wpmMetrics && h('div', { style: { display: 'flex', flexDirection: 'column' } },
              h('span', { className: 'stopwatch-wpm' }, `${wpmMetrics.wpm} WPM`),
              h('span', { style: { fontSize: '0.7rem', color: wpmMetrics.colorClass, fontWeight: 600 } }, wpmMetrics.evaluation)
            )
          )
        )
      ),

      h('div', { className: 'study-actions' },
        h('button', { 
          className: 'btn btn-danger', 
          onClick: () => markCard(false, true) 
        }, 
          h('i', { className: 'fas fa-times' }), ' Needs Practice'
        ),
        h('button', { 
          className: 'btn btn-success', 
          onClick: () => markCard(true, false) 
        }, 
          h('i', { className: 'fas fa-check' }), ' Mastered'
        )
      )
    );
  }

  window.StudySession = StudySession;
})();
