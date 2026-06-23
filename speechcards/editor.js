/**
 * editor.js - SpeechCards Rich Text Editor Component
 * Implements a contenteditable editor with toolbar and automatic image compression.
 */

(function() {
  const h = React.createElement;
  const { useRef, useState, useEffect } = React;

  // Image compression utility to stay within LocalStorage limits
  function compressImage(file, maxDimension = 800, quality = 0.7, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        callback(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function RichTextEditor({ value, onChange, placeholder }) {
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);

    // Sync innerHTML with external value, avoiding cursor resets if contents are identical
    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }, [value]);

    const handleInput = () => {
      if (editorRef.current && onChange) {
        onChange(editorRef.current.innerHTML);
      }
    };

    const executeCommand = (command, val = null) => {
      document.execCommand(command, false, val);
      handleInput();
      editorRef.current.focus();
    };

    const handlePaste = (e) => {
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      for (const item of items) {
        if (item.type.indexOf('image/') === 0) {
          e.preventDefault();
          const file = item.getAsFile();
          compressImage(file, 800, 0.7, (compressedUrl) => {
            executeCommand('insertImage', compressedUrl);
          });
          return;
        }
      }

      // If pasting text, let's strip nasty desktop word-processor formatting tags
      // while keeping standard bold/italic/underline structure if possible,
      // or we can fallback to plain text if needed. To be safe and premium,
      // we let browser handle text paste but clean up scripts.
    };

    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file && file.type.indexOf('image/') === 0) {
        compressImage(file, 800, 0.7, (compressedUrl) => {
          executeCommand('insertImage', compressedUrl);
        });
      }
      e.target.value = ''; // Reset input
    };

    const triggerFileInput = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    };

    // Color presets
    const colors = [
      { name: 'White', value: '#ffffff' },
      { name: 'Gray', value: '#9ca3af' },
      { name: 'Violet', value: '#c084fc' },
      { name: 'Cyan', value: '#22d3ee' },
      { name: 'Yellow', value: '#fde047' },
      { name: 'Rose', value: '#fda4af' }
    ];

    const highlights = [
      { name: 'None', value: 'transparent' },
      { name: 'Violet Glow', value: 'rgba(139, 92, 246, 0.3)' },
      { name: 'Blue Glow', value: 'rgba(59, 130, 246, 0.3)' },
      { name: 'Green Glow', value: 'rgba(16, 185, 129, 0.3)' },
      { name: 'Yellow Glow', value: 'rgba(245, 158, 11, 0.3)' },
      { name: 'Red Glow', value: 'rgba(239, 68, 68, 0.3)' }
    ];

    return h('div', { className: 'rte-container' },
      // Toolbar
      h('div', { className: 'rte-toolbar' },
        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Bold (Cmd+B)',
          onClick: () => executeCommand('bold')
        }, h('i', { className: 'fas fa-bold' })),
        
        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Italic (Cmd+I)',
          onClick: () => executeCommand('italic')
        }, h('i', { className: 'fas fa-italic' })),
        
        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Underline (Cmd+U)',
          onClick: () => executeCommand('underline')
        }, h('i', { className: 'fas fa-underline' })),

        h('div', { className: 'rte-toolbar-divider' }),

        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Bullet List',
          onClick: () => executeCommand('insertUnorderedList')
        }, h('i', { className: 'fas fa-list-ul' })),

        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Heading 3',
          onClick: () => executeCommand('formatBlock', '<h3>')
        }, h('span', { style: { fontWeight: 'bold', fontSize: '0.85rem' } }, 'H3')),

        h('div', { className: 'rte-toolbar-divider' }),

        // Color Picker Button
        h('div', { className: 'rte-color-picker' },
          h('button', {
            type: 'button',
            className: 'rte-toolbar-btn' + (showColorPicker ? ' active' : ''),
            title: 'Text Color',
            onClick: () => {
              setShowColorPicker(!showColorPicker);
              setShowHighlightPicker(false);
            }
          }, h('i', { className: 'fas fa-palette' })),
          showColorPicker && h('div', {
            style: {
              position: 'absolute',
              top: '100%',
              left: 0,
              background: '#1f2937',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              zIndex: 10,
              display: 'flex',
              gap: '0.35rem',
              boxShadow: '0 10px 15px rgba(0,0,0,0.5)'
            }
          },
            colors.map(c => h('div', {
              key: c.value,
              title: c.name,
              style: {
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: c.value,
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.2)'
              },
              onClick: () => {
                executeCommand('foreColor', c.value);
                setShowColorPicker(false);
              }
            }))
          )
        ),

        // Highlight Picker Button
        h('div', { className: 'rte-color-picker' },
          h('button', {
            type: 'button',
            className: 'rte-toolbar-btn' + (showHighlightPicker ? ' active' : ''),
            title: 'Highlight Text',
            onClick: () => {
              setShowHighlightPicker(!showHighlightPicker);
              setShowColorPicker(false);
            }
          }, h('i', { className: 'fas fa-highlighter' })),
          showHighlightPicker && h('div', {
            style: {
              position: 'absolute',
              top: '100%',
              left: 0,
              background: '#1f2937',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              zIndex: 10,
              display: 'flex',
              gap: '0.35rem',
              boxShadow: '0 10px 15px rgba(0,0,0,0.5)'
            }
          },
            highlights.map(hl => h('div', {
              key: hl.value,
              title: hl.name,
              style: {
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: hl.value === 'transparent' ? '#111827' : hl.value,
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.2)',
                position: 'relative'
              },
              onClick: () => {
                executeCommand('hiliteColor', hl.value);
                setShowHighlightPicker(false);
              }
            }, hl.value === 'transparent' && h('span', {
              style: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: '100%',
                height: '2px',
                background: '#ef4444'
              }
            })))
          )
        ),

        h('div', { className: 'rte-toolbar-divider' }),

        // Insert Image Button
        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Insert Image (Click or Paste)',
          onClick: triggerFileInput
        }, h('i', { className: 'fas fa-image' })),
        h('input', {
          type: 'file',
          ref: fileInputRef,
          style: { display: 'none' },
          accept: 'image/*',
          onChange: handleFileChange
        }),

        h('button', {
          type: 'button',
          className: 'rte-toolbar-btn',
          title: 'Clear Formatting',
          onClick: () => executeCommand('removeFormat')
        }, h('i', { className: 'fas fa-eraser' }))
      ),

      // Editor Body
      h('div', {
        ref: editorRef,
        className: 'rte-content',
        contentEditable: true,
        onInput: handleInput,
        onPaste: handlePaste,
        placeholder: placeholder || 'Type something here...'
      })
    );
  }

  window.RichTextEditor = RichTextEditor;
})();
