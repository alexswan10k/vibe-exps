/**
 * deck-manager.js - SpeechCards Decks Dashboard Component
 * Renders the decks listing, statistics trackers, and export/import commands.
 */

(function() {
  const h = React.createElement;
  const { useState, useMemo, useRef } = React;

  function DeckManager({ decks, onSelectDeck, onStudyDeck, onCreateDeck, onDeleteDeck, onImportBackup, onExportBackup }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated'); // updated | alpha | cards
    
    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newDeckTitle, setNewDeckTitle] = useState('');
    const [newDeckDesc, setNewDeckDesc] = useState('');

    const fileInputRef = useRef(null);

    // Compute stats for a single deck
    const getDeckStats = (deck) => {
      const total = deck.cards ? deck.cards.length : 0;
      const mastered = deck.cards ? deck.cards.filter(c => c.mastered).length : 0;
      const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;
      return { total, mastered, progress };
    };

    // Filter and Sort decks
    const processedDecks = useMemo(() => {
      let result = [...decks];
      
      // Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(d => 
          d.title.toLowerCase().includes(query) || 
          (d.description && d.description.toLowerCase().includes(query))
        );
      }
      
      // Sort
      result.sort((a, b) => {
        if (sortBy === 'alpha') {
          return a.title.localeCompare(b.title);
        } else if (sortBy === 'cards') {
          const aCount = a.cards ? a.cards.length : 0;
          const bCount = b.cards ? b.cards.length : 0;
          return bCount - aCount;
        } else {
          // 'updated'
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        }
      });
      
      return result;
    }, [decks, searchQuery, sortBy]);

    // Handle Create Deck Submit
    const handleCreateSubmit = (e) => {
      e.preventDefault();
      if (!newDeckTitle.trim()) return;
      
      onCreateDeck({
        title: newDeckTitle,
        description: newDeckDesc,
        cards: []
      });
      
      setNewDeckTitle('');
      setNewDeckDesc('');
      setShowCreateModal(false);
    };

    // Trigger Import JSON file dialog
    const triggerImport = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    };

    const handleImportFile = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          onImportBackup(event.target.result);
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset file input
    };

    // Trigger export of a single deck
    const handleExportDeck = (e, deck) => {
      e.stopPropagation();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        version: "1.0",
        exportedAt: Date.now(),
        decks: [deck]
      }, null, 2));
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${deck.title.toLowerCase().replace(/\s+/g, '_')}_deck.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    };

    return h('div', { className: 'dashboard-view' },
      // Dashboard Header
      h('div', { className: 'dashboard-header' },
        h('div', { className: 'dashboard-title' },
          h('h2', null, 'My Speeches'),
          h('p', null, 'Manage and rehearse your speech deliveries offline')
        ),
        h('div', { style: { display: 'flex', gap: '0.75rem' } },
          h('button', { className: 'btn btn-secondary', onClick: triggerImport, title: 'Import Speeches Backup' },
            h('i', { className: 'fas fa-file-import' }), ' Import Collection'
          ),
          h('button', { className: 'btn btn-secondary', onClick: onExportBackup, title: 'Export Full Database Backup' },
            h('i', { className: 'fas fa-file-export' }), ' Export Backup'
          ),
          h('button', { className: 'btn btn-primary', onClick: () => setShowCreateModal(true) },
            h('i', { className: 'fas fa-plus' }), ' New Speech'
          ),
          h('input', {
            type: 'file',
            ref: fileInputRef,
            style: { display: 'none' },
            accept: '.json',
            onChange: handleImportFile
          })
        )
      ),

      // Search and Filter Bar
      h('div', { 
        className: 'glass-panel', 
        style: { padding: '1rem', display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' } 
      },
        h('div', { className: 'cards-search-wrapper', style: { flex: 1, minWidth: '240px' } },
          h('i', { className: 'fas fa-search cards-search-icon' }),
          h('input', {
            type: 'text',
            className: 'cards-search-input',
            placeholder: 'Search speeches...',
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value)
          })
        ),
        h('div', { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' } },
          h('span', { className: 'toolkit-label' }, 'Sort by:'),
          h('select', {
            value: sortBy,
            onChange: (e) => setSortBy(e.target.value),
            style: {
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'white',
              border: '1px solid var(--panel-border)',
              borderRadius: '0.75rem',
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              outline: 'none'
            }
          },
            h('option', { value: 'updated' }, 'Last Updated'),
            h('option', { value: 'alpha' }, 'Alphabetical'),
            h('option', { value: 'cards' }, 'Number of Cards')
          )
        )
      ),

      // Empty State
      processedDecks.length === 0 && h('div', { 
        className: 'glass-panel', 
        style: { padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' } 
      },
        h('div', { 
          style: { 
            fontSize: '3rem', 
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem'
          } 
        }, h('i', { className: 'fas fa-microphone-slash' })),
        h('h3', { style: { fontSize: '1.5rem', fontWeight: 700 } }, 'No Speeches Found'),
        h('p', { style: { color: 'var(--text-secondary)', maxWidth: '400px' } }, 
          searchQuery 
            ? 'No speeches matched your search. Try resetting the query filters.'
            : 'Create your first speech or import a collection backup to start practicing!'
        ),
        !searchQuery && h('button', { className: 'btn btn-primary', onClick: () => setShowCreateModal(true) }, 'Create a Speech')
      ),

      // Decks Grid
      h('div', { className: 'decks-grid' },
        processedDecks.map(deck => {
          const stats = getDeckStats(deck);
          return h('div', { 
            key: deck.id, 
            className: 'deck-card glass-panel',
            onClick: () => onSelectDeck(deck.id)
          },
            // Title & Desc
            h('div', null,
              h('div', { className: 'deck-meta' },
                h('div', { className: 'deck-title' }, deck.title),
                h('div', { style: { display: 'flex', gap: '0.25rem' } },
                  h('button', { 
                    className: 'btn btn-secondary btn-icon', 
                    style: { width: '1.75rem', height: '1.75rem', fontSize: '0.75rem' },
                    title: 'Export Individual Speech', 
                    onClick: (e) => handleExportDeck(e, deck)
                  }, h('i', { className: 'fas fa-download' })),
                  h('button', { 
                    className: 'btn btn-secondary btn-icon', 
                    style: { width: '1.75rem', height: '1.75rem', fontSize: '0.75rem', hoverColor: 'var(--color-danger)' },
                    title: 'Delete Speech', 
                    onClick: (e) => { e.stopPropagation(); onDeleteDeck(deck.id); }
                  }, h('i', { className: 'fas fa-trash-alt', style: { color: 'var(--color-danger)' } }))
                )
              ),
              h('div', { className: 'deck-desc' }, deck.description || 'No description provided.')
            ),
            
            // Progress details
            h('div', { className: 'deck-stats-row' },
              h('div', { className: 'deck-card-count' }, 
                h('i', { className: 'fas fa-copy' }), `${stats.total} Card${stats.total !== 1 ? 's' : ''}`
              ),
              stats.total > 0 && h('div', { className: 'deck-progress-wrapper' },
                h('div', { className: 'deck-progress-bar' },
                  h('div', { className: 'deck-progress-fill', style: { width: `${stats.progress}%` } })
                ),
                h('span', { className: 'deck-progress-text' }, `${stats.progress}%`)
              )
            ),

            // Main Actions
            h('div', { className: 'deck-actions' },
              h('button', { 
                className: 'btn btn-secondary', 
                style: { padding: '0.5rem 0.75rem', fontSize: '0.85rem' },
                onClick: (e) => { e.stopPropagation(); onSelectDeck(deck.id); } 
              }, h('i', { className: 'fas fa-edit' }), ' Edit'),
              h('button', { 
                className: 'btn btn-secondary',
                style: { padding: '0.5rem 0.75rem', fontSize: '0.85rem' },
                disabled: stats.total === 0, 
                onClick: (e) => { e.stopPropagation(); onStudyDeck(deck.id, 'practice'); } 
              }, h('i', { className: 'fas fa-graduation-cap' }), ' Practice'),
              h('button', { 
                className: 'btn btn-primary',
                style: { padding: '0.5rem 0.75rem', fontSize: '0.85rem' },
                disabled: stats.total === 0, 
                onClick: (e) => { e.stopPropagation(); onStudyDeck(deck.id, 'present'); } 
              }, h('i', { className: 'fas fa-microphone' }), ' Present')
            )
          );
        })
      ),

      // Create Deck Modal
      showCreateModal && h('div', { className: 'modal-overlay' },
        h('div', { className: 'modal-content glass-panel' },
          h('div', { className: 'modal-header' },
            h('h3', null, 'Create New Speech Deck')
          ),
          h('form', { onSubmit: handleCreateSubmit },
            h('div', { className: 'form-group', style: { marginBottom: '1rem' } },
              h('label', { className: 'form-label' }, 'Speech Name / Title'),
              h('input', {
                type: 'text',
                className: 'form-input',
                required: true,
                placeholder: 'e.g., Commencement Address 2026',
                value: newDeckTitle,
                onChange: (e) => setNewDeckTitle(e.target.value)
              })
            ),
            h('div', { className: 'form-group', style: { marginBottom: '1.5rem' } },
              h('label', { className: 'form-label' }, 'Description / Target Venue'),
              h('input', {
                type: 'text',
                className: 'form-input',
                placeholder: 'e.g., For graduation ceremony, 5-minute delivery.',
                value: newDeckDesc,
                onChange: (e) => setNewDeckDesc(e.target.value)
              })
            ),
            h('div', { className: 'modal-footer' },
              h('button', { type: 'button', className: 'btn btn-secondary', onClick: () => { setShowCreateModal(false); setNewDeckTitle(''); setNewDeckDesc(''); } }, 'Cancel'),
              h('button', { type: 'submit', className: 'btn btn-primary' }, 'Create')
            )
          )
        )
      )
    );
  }

  window.DeckManager = DeckManager;
})();
