/**
 * db.js - SpeechCards Database Layer
 * Handles LocalStorage storage, seeding, and JSON serialization.
 */

(function() {
  const STORAGE_KEY = 'speechcards_decks_db';

  const GETTYSBURG_ADDRESS_CARDS = [
    {
      id: 'gb_1',
      title: '1. Dedication & Foundation',
      front: '<div><strong>Prompt:</strong> How did our fathers establish the nation?</div>',
      back: '<div>Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'gb_2',
      title: '2. The Great Civil War',
      front: '<div><strong>Prompt:</strong> What is the war testing, and why are we met?</div>',
      back: '<div>Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'gb_3',
      title: '3. Dedicating the Ground',
      front: '<div><strong>Prompt:</strong> Can we dedicate or consecrate this ground?</div>',
      back: '<div>But, in a larger sense, we can not dedicate—we can not consecrate—we can not hallow—this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here.</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'gb_4',
      title: '4. The Great Task Remaining',
      front: '<div><strong>Prompt:</strong> What is the great task remaining before us?</div>',
      back: '<div>It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us—that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion—that we here highly resolve that these dead shall not have died in vain—that this nation, under God, shall have a new birth of freedom—and that government of the people, by the people, for the people, shall not perish from the earth.</div>',
      mastered: false,
      needsReview: false
    }
  ];

  const MLK_DREAM_CARDS = [
    {
      id: 'mlk_1',
      title: '1. Five Score Years Ago',
      front: '<div><strong>Prompt:</strong> Mention MLK\'s opening reference to Lincoln and the Emancipation Proclamation.</div>',
      back: '<div>Five score years ago, a great American, in whose symbolic shadow we stand today, signed the Emancipation Proclamation. This momentous decree came as a great beacon light of hope to millions of Negro slaves who had been seared in the flames of withering injustice. It came as a joyous daybreak to end the long night of their captivity.</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'mlk_2',
      title: '2. One Hundred Years Later',
      front: '<div><strong>Prompt:</strong> What is the tragic fact MLK outlines about the present?</div>',
      back: '<div>But one hundred years later, the Negro still is not free. One hundred years later, the life of the Negro is still sadly crippled by the manacles of segregation and the chains of discrimination. One hundred years later, the Negro lives on a lonely island of poverty in the midst of a vast ocean of material prosperity. One hundred years later, the Negro is still languishing in the corners of American society and finds himself in exile in his own land. So we have come here today to dramatize a shameful condition.</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'mlk_3',
      title: '3. The Promissory Note',
      front: '<div><strong>Prompt:</strong> What is the metaphor of the check and promissory note?</div>',
      back: '<div>In a sense we have come to our nation\'s capital to cash a check. When the architects of our republic wrote the magnificent words of the Constitution and the Declaration of Independence, they were signing a promissory note to which every American was to fall heir. This note was a promise that all men, yes, black men as well as white men, would be guaranteed the unalienable rights of life, liberty, and the pursuit of happiness.</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'mlk_4',
      title: '4. I Have a Dream',
      front: '<div><strong>Prompt:</strong> State MLK\'s core "dream" for the future.</div>',
      back: '<div>I say to you today, my friends, so even though we face the difficulties of today and tomorrow, I still have a dream. It is a dream deeply rooted in the American dream. I have a dream that one day this nation will rise up and live out the true meaning of its creed: "We hold these truths to be self-evident, that all men are created equal."</div>',
      mastered: false,
      needsReview: false
    },
    {
      id: 'mlk_5',
      title: '5. Let Freedom Ring',
      front: '<div><strong>Prompt:</strong> How does MLK conclude the speech?</div>',
      back: '<div>And when this happens, and when we allow freedom ring, when we let it ring from every village and every hamlet, from every state and every city, we will be able to speed up that day when all of God\'s children, black men and white men, Jews and Gentiles, Protestants and Catholics, will be able to join hands and sing in the words of the old Negro spiritual: "Free at last! Free at last! Thank God Almighty, we are free at last!"</div>',
      mastered: false,
      needsReview: false
    }
  ];

  const SEED_DECKS = [
    {
      id: 'deck_gettysburg',
      title: 'Gettysburg Address',
      description: 'Abraham Lincoln - November 19, 1863. A milestone speech in American democracy.',
      createdAt: 1782298143000,
      updatedAt: 1782298143000,
      cards: GETTYSBURG_ADDRESS_CARDS
    },
    {
      id: 'deck_mlk_dream',
      title: 'I Have a Dream',
      description: 'Dr. Martin Luther King Jr. - August 28, 1963. Key sections from the historic civil rights speech.',
      createdAt: 1782298150000,
      updatedAt: 1782298150000,
      cards: MLK_DREAM_CARDS
    }
  ];

  window.SpeechDB = {
    getAllDecks: function() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
          // Seed the database
          this.saveAllDecks(SEED_DECKS);
          return SEED_DECKS;
        }
        return JSON.parse(data);
      } catch (e) {
        console.error('Error reading localStorage database:', e);
        return SEED_DECKS;
      }
    },

    saveAllDecks: function(decks) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
        return true;
      } catch (e) {
        console.error('Error writing to localStorage database:', e);
        throw e; // Reraise for UI display of quota issues
      }
    },

    getDeckById: function(id) {
      const decks = this.getAllDecks();
      return decks.find(d => d.id === id) || null;
    },

    saveDeck: function(updatedDeck) {
      const decks = this.getAllDecks();
      const index = decks.findIndex(d => d.id === updatedDeck.id);
      
      updatedDeck.updatedAt = Date.now();
      
      if (index > -1) {
        decks[index] = updatedDeck;
      } else {
        updatedDeck.createdAt = Date.now();
        decks.push(updatedDeck);
      }
      return this.saveAllDecks(decks);
    },

    deleteDeck: function(deckId) {
      const decks = this.getAllDecks();
      const filtered = decks.filter(d => d.id !== deckId);
      return this.saveAllDecks(filtered);
    },

    // Serialization Exports/Imports
    exportAllToJSON: function() {
      const decks = this.getAllDecks();
      const exportData = {
        version: '1.0',
        exportedAt: Date.now(),
        decks: decks
      };
      return JSON.stringify(exportData, null, 2);
    },

    importAllFromJSON: function(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || !Array.isArray(parsed.decks)) {
          throw new Error('Invalid export file format: missing decks array.');
        }
        
        // Basic structure validation
        parsed.decks.forEach(deck => {
          if (!deck.id || !deck.title || !Array.isArray(deck.cards)) {
            throw new Error('Invalid deck structure. Missing id, title, or cards.');
          }
        });

        this.saveAllDecks(parsed.decks);
        return true;
      } catch (e) {
        console.error('Import failed:', e);
        throw e;
      }
    }
  };
})();
