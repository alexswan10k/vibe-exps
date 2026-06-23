/**
 * app-shell.js - SpeechCards Core Router & Editor Workspace View
 * Coordinates tab routing, inline deck editing, list search, and card details modification.
 */

(function() {
  const h = React.createElement;
  const { useState, useEffect, useMemo } = React;

  function AppShell() {
    const [view, setView] = useState('decks'); // decks | edit | study
    const [decks, setDecks] = useState([]);
    const [activeDeckId, setActiveDeckId] = useState(null);
    const [activeCardId, setActiveCardId] = useState(null);

    // Load initial decks on mount
    useEffect(() => {
      setDecks(window.SpeechDB.getAllDecks());
    }, []);

    const activeDeck = useMemo(() => {
      return decks.find(d => d.id === activeDeckId) || null;
    }, [decks, activeDeckId]);

    const activeCard = useMemo(() => {
      if (!activeDeck) return null;
      return activeDeck.cards.find(c => c.id === activeCardId) || null;
    }, [activeDeck, activeCardId]);

    // DB Synchronizers
    const saveDecksToDB = (updatedDecks) => {
      setDecks(updatedDecks);
      window.SpeechDB.saveAllDecks(updatedDecks);
    };

    // Create Deck Command
    const handleCreateDeck = (deckData) => {
      const newDeck = {
        ...deckData,
        id: 'deck_' + Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const updatedDecks = [newDeck, ...decks];
      saveDecksToDB(updatedDecks);
      setActiveDeckId(newDeck.id);
      setView('edit');
      // Auto-create first card
      handleCreateCard(newDeck.id);
    };

    // Delete Deck Command
    const handleDeleteDeck = (deckId) => {
      const deck = decks.find(d => d.id === deckId);
      if (confirm(`Are you sure you want to delete the speech deck "${deck.title}"?`)) {
        const updated = decks.filter(d => d.id !== deckId);
        saveDecksToDB(updated);
        if (activeDeckId === deckId) {
          setActiveDeckId(null);
          setActiveCardId(null);
        }
      }
    };

    // Edit Deck metadata inline
    const handleUpdateDeckMetadata = (field, value) => {
      if (!activeDeck) return;
      const updated = decks.map(d => {
        if (d.id === activeDeckId) {
          return { ...d, [field]: value, updatedAt: Date.now() };
        }
        return d;
      });
      saveDecksToDB(updated);
    };

    // Card Management inside active deck
    const handleCreateCard = (deckId = activeDeckId) => {
      const targetDeck = decks.find(d => d.id === deckId);
      if (!targetDeck) return;

      const newCard = {
        id: 'card_' + Date.now(),
        title: `Section ${targetDeck.cards.length + 1}`,
        front: '<div><strong>Cue:</strong> </div>',
        back: '<div></div>',
        mastered: false,
        needsReview: false
      };

      const updatedDecks = decks.map(d => {
        if (d.id === deckId) {
          return {
            ...d,
            cards: [...d.cards, newCard],
            updatedAt: Date.now()
          };
        }
        return d;
      });

      saveDecksToDB(updatedDecks);
      setActiveCardId(newCard.id);
    };

    const handleDeleteCard = (cardId) => {
      if (!activeDeck) return;
      if (confirm('Delete this card from your speech?')) {
        const updatedCards = activeDeck.cards.filter(c => c.id !== cardId);
        const updatedDecks = decks.map(d => {
          if (d.id === activeDeckId) {
            return { ...d, cards: updatedCards, updatedAt: Date.now() };
          }
          return d;
        });
        saveDecksToDB(updatedDecks);
        
        // Select another card
        if (activeCardId === cardId) {
          setActiveCardId(updatedCards.length > 0 ? updatedCards[0].id : null);
        }
      }
    };

    const handleUpdateCardField = (cardId, field, value) => {
      if (!activeDeck) return;
      const updatedCards = activeDeck.cards.map(c => {
        if (c.id === cardId) {
          return { ...c, [field]: value };
        }
        return c;
      });
      
      const updatedDecks = decks.map(d => {
        if (d.id === activeDeckId) {
          return { ...d, cards: updatedCards, updatedAt: Date.now() };
        }
        return d;
      });
      saveDecksToDB(updatedDecks);
    };

    // Full Backup controls
    const handleImportBackup = (jsonString) => {
      try {
        window.SpeechDB.importAllFromJSON(jsonString);
        setDecks(window.SpeechDB.getAllDecks());
        alert('Speeches collection successfully imported!');
      } catch (e) {
        alert('Failed to import database: ' + e.message);
      }
    };

    const handleExportBackup = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(window.SpeechDB.exportAllToJSON());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "speechcards_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    };

    // Search and filters for cards list
    const [cardSearchQuery, setCardSearchQuery] = useState('');
    const filteredCards = useMemo(() => {
      if (!activeDeck) return [];
      const cards = activeDeck.cards || [];
      if (!cardSearchQuery.trim()) return cards;
      const q = cardSearchQuery.toLowerCase();
      return cards.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.front.toLowerCase().includes(q) || 
        c.back.toLowerCase().includes(q)
      );
    }, [activeDeck, cardSearchQuery]);

    // Handle view swaps
    const showDecksView = () => {
      setView('decks');
      setActiveDeckId(null);
      setActiveCardId(null);
      setCardSearchQuery('');
    };

    const showStudyView = (deckId, mode = 'practice') => {
      setActiveDeckId(deckId);
      setView(mode === 'present' ? 'present' : 'study');
    };

    const showEditView = (deckId) => {
      setActiveDeckId(deckId);
      setView('edit');
      const target = decks.find(d => d.id === deckId);
      if (target && target.cards.length > 0) {
        setActiveCardId(target.cards[0].id);
      } else {
        setActiveCardId(null);
      }
    };

    return h('div', { className: 'app-container' },
      // Main Navbar (Hidden in presentation mode)
      view !== 'present' && h('header', { className: 'app-header' },
        h('div', { className: 'logo-section', onClick: showDecksView },
          h('div', { className: 'logo-icon' }, h('i', { className: 'fas fa-microphone-alt' })),
          h('div', { className: 'logo-text' }, 'SpeechCards')
        ),
        h('div', { className: 'nav-actions' },
          view !== 'decks' && h('button', { className: 'btn btn-secondary', onClick: showDecksView },
            h('i', { className: 'fas fa-th-large' }), h('span', null, 'Speeches Dashboard')
          ),
          view === 'edit' && activeDeck && h('button', { 
            className: 'btn btn-primary', 
            disabled: activeDeck.cards.length === 0,
            onClick: () => showStudyView(activeDeckId, 'practice') 
          },
            h('i', { className: 'fas fa-graduation-cap' }), h('span', null, 'Rehearse Speech')
          )
        )
      ),

      // Route Dispatcher
      view === 'decks' && h(window.DeckManager, {
        decks,
        onSelectDeck: showEditView,
        onStudyDeck: showStudyView,
        onCreateDeck: handleCreateDeck,
        onDeleteDeck: handleDeleteDeck,
        onImportBackup: handleImportBackup,
        onExportBackup: handleExportBackup
      }),

      view === 'study' && activeDeck && h(window.StudySession, {
        deck: activeDeck,
        presentationMode: false,
        onClose: () => setView('edit')
      }),

      view === 'present' && activeDeck && h(window.StudySession, {
        deck: activeDeck,
        presentationMode: true,
        onClose: showDecksView
      }),

      // Card Editor View Layout
      view === 'edit' && activeDeck && h('div', { className: 'editor-view' },
        
        // Sidebar list
        h('div', { className: 'editor-sidebar' },
          h('div', { className: 'sidebar-header' },
            // Inline deck renaming & description
            h('div', { className: 'deck-details-edit' },
              h('input', {
                type: 'text',
                className: 'deck-title-input',
                value: activeDeck.title,
                onChange: (e) => handleUpdateDeckMetadata('title', e.target.value),
                placeholder: 'Deck Title'
              }),
              h('input', {
                type: 'text',
                style: {
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  outline: 'none',
                  padding: '0.25rem'
                },
                value: activeDeck.description || '',
                onChange: (e) => handleUpdateDeckMetadata('description', e.target.value),
                placeholder: 'Deck description or tags'
              })
            ),
            
            // Search Card Input
            h('div', { className: 'cards-search-wrapper' },
              h('i', { className: 'fas fa-search cards-search-icon' }),
              h('input', {
                type: 'text',
                className: 'cards-search-input',
                placeholder: 'Filter sections...',
                value: cardSearchQuery,
                onChange: (e) => setCardSearchQuery(e.target.value)
              })
            )
          ),

          // Cards list items
          h('div', { className: 'sidebar-cards-list' },
            filteredCards.map(c => h('div', {
              key: c.id,
              className: 'sidebar-card-item' + (activeCardId === c.id ? ' active' : ''),
              onClick: () => setActiveCardId(c.id)
            },
              h('span', { className: 'sidebar-card-title' }, c.title || 'Untitled Section'),
              c.mastered 
                ? h('span', { className: 'sidebar-card-badge badge-mastered' }, 'Mastered')
                : h('span', { className: 'sidebar-card-badge badge-learning' }, 'Learning')
            ))
          ),

          // Add card button in sidebar
          h('div', { className: 'sidebar-actions' },
            h('button', { className: 'btn btn-primary', onClick: () => handleCreateCard() },
              h('i', { className: 'fas fa-plus' }), ' Add Section'
            )
          )
        ),

        // Main Editor Pane
        h('div', { className: 'editor-workspace' },
          activeCard ? h('div', { className: 'editor-workspace-body' },
            
            // Editor Workspace Header
            h('div', { className: 'editor-workspace-header glass-panel' },
              h('div', { className: 'card-title-editor' },
                h('input', {
                  type: 'text',
                  className: 'card-title-field',
                  value: activeCard.title || '',
                  onChange: (e) => handleUpdateCardField(activeCardId, 'title', e.target.value),
                  placeholder: 'Section Name / Title'
                })
              ),
              h('button', { className: 'btn btn-danger', onClick: () => handleDeleteCard(activeCardId) },
                h('i', { className: 'fas fa-trash-alt' }), ' Delete Section'
              )
            ),

            // Card Front side edit field
            h('div', { className: 'editor-field-section' },
              h('div', { className: 'editor-field-label' }, 
                h('span', null, 'Card Front (Key Prompts & Cues)'),
                h('span', { style: { color: 'var(--text-muted)', fontSize: '0.75rem' } }, 'Short bullet points to prompt your memory')
              ),
              h(window.RichTextEditor, {
                value: activeCard.front,
                placeholder: 'e.g. Highlight "Dedication", prompt "Emancipation Proclamation"...',
                onChange: (htmlVal) => handleUpdateCardField(activeCardId, 'front', htmlVal)
              })
            ),

            // Card Back side edit field
            h('div', { className: 'editor-field-section', style: { marginBottom: '2rem' } },
              h('div', { className: 'editor-field-label' },
                h('span', null, 'Card Back (Speech Script / Paragraph)'),
                h('span', { style: { color: 'var(--text-muted)', fontSize: '0.75rem' } }, 'Paste formatted text or drop an image')
              ),
              h(window.RichTextEditor, {
                value: activeCard.back,
                placeholder: 'e.g. Four score and seven years ago...',
                onChange: (htmlVal) => handleUpdateCardField(activeCardId, 'back', htmlVal)
              })
            )

          ) : h('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)',
              gap: '1rem'
            }
          },
            h('div', { style: { fontSize: '3rem' } }, h('i', { className: 'fas fa-edit' })),
            h('h4', { style: { fontSize: '1.25rem', fontWeight: 600 } }, 'No Section Selected'),
            h('p', { style: { fontSize: '0.9rem', color: 'var(--text-muted)' } }, 'Select an existing speech section from the sidebar or add a new one.'),
            h('button', { className: 'btn btn-primary', onClick: () => handleCreateCard() }, 'Create a Section')
          )
        )

      )
    );
  }

  window.AppShell = AppShell;
})();
