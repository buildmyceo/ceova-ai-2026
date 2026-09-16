import re
import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update ItemMenu signature
    content = content.replace(
        'function ItemMenu({ item, onPreview, onDownload, onVisit, onSummarize, onOCR }) {',
        'function ItemMenu({ item, onPreview, onDownload, onVisit, onSummarize, onOCR, onDelete }) {'
    )
    # Add Delete button to ItemMenu
    content = content.replace(
        '''          {onOCR && (
            <button onClick={() => { setOpen(false); onOCR(item); }}>OCR / Extract Text</button>
          )}''',
        '''          {onOCR && (
            <button onClick={() => { setOpen(false); onOCR(item); }}>OCR / Extract Text</button>
          )}
          {onDelete && (
            <button onClick={() => { setOpen(false); onDelete(item); }} style={{ color: '#ef4444' }}>Delete</button>
          )}'''
    )

    # 2. Update CalendarCard
    content = content.replace(
        'export function CalendarCard({ item, onClick, onPreview, onVisit, onSummarize }) {',
        'export function CalendarCard({ item, onClick, onPreview, onVisit, onSummarize, onDelete }) {'
    )
    content = content.replace(
        '''      <ItemMenu
        item={item}
        onPreview={onPreview}
        onVisit={onVisit}
        onSummarize={onSummarize}
      />''',
        '''      <ItemMenu
        item={item}
        onPreview={onPreview}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onDelete={onDelete}
      />'''
    )

    # 3. Update MailCard
    content = content.replace(
        'export function MailCard({ item, onClick, onPreview, onVisit, onSummarize }) {',
        'export function MailCard({ item, onClick, onPreview, onVisit, onSummarize, onDelete }) {'
    )
    # MailCard has the same ItemMenu block as CalendarCard in terms of arguments in this component
    content = content.replace(
        '''      <ItemMenu
        item={item}
        onPreview={onPreview}
        onVisit={onVisit}
        onSummarize={onSummarize}
      />''',
        '''      <ItemMenu
        item={item}
        onPreview={onPreview}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onDelete={onDelete}
      />'''
    )

    # 4. Update ImageCard
    content = content.replace(
        'export function ImageCard({ item, onClick, onPreview, onDownload, onVisit }) {',
        'export function ImageCard({ item, onClick, onPreview, onDownload, onVisit, onDelete }) {'
    )
    content = content.replace(
        '<ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} />',
        '<ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} onDelete={onDelete} />'
    )

    # 5. Update FileCard
    content = content.replace(
        'export function FileCard({ item, onClick, onPreview, onDownload, onVisit, onSummarize, onOCR }) {',
        'export function FileCard({ item, onClick, onPreview, onDownload, onVisit, onSummarize, onOCR, onDelete }) {'
    )
    content = content.replace(
        '''      <ItemMenu
        item={item}
        onPreview={onPreview}
        onDownload={onDownload}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onOCR={onOCR}
      />''',
        '''      <ItemMenu
        item={item}
        onPreview={onPreview}
        onDownload={onDownload}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onOCR={onOCR}
        onDelete={onDelete}
      />'''
    )

    # 6. Update ActionCard
    content = content.replace(
        'function ActionCard({ item, onPreview, onDownload, onVisit }) {',
        'function ActionCard({ item, onPreview, onDownload, onVisit, onDelete }) {'
    )
    # In ActionCard, ItemMenu looks like:
    # <ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} />
    content = content.replace(
        '<ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} />',
        '<ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} onDelete={onDelete} />'
    )

    # 7. Add handleDelete and handleClearCeovaDrive to Library
    func_insert = """
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    setLoading(true);
    try {
      if (item.source === 'gmail') {
        await supabase.from('gmail_emails').delete().eq('id', item.id.replace('db-gmail-', ''));
      } else if (item.source === 'gcalendar') {
        await supabase.from('calendar_events').delete().eq('id', item.id.replace('db-gcal-', ''));
      } else if (item.source === 'gdrive') {
        await supabase.from('files').delete().eq('id', item.id);
      } else if (item.id.startsWith('aig-')) {
        await supabase.from('ai_generated_files').delete().eq('id', item.id.replace('aig-', ''));
      } else if (item.id.startsWith('att-')) {
        const msgId = item.id.split('-')[1];
        const { data: msg } = await supabase.from('messages').select('attachments').eq('id', msgId).single();
        if (msg && msg.attachments) {
           const newAtt = msg.attachments.filter(a => a.name !== item.name && a.url !== item.url);
           await supabase.from('messages').update({ attachments: newAtt }).eq('id', msgId);
        }
      } else {
        await supabase.from('files').delete().eq('id', item.id);
      }
      
      const newItems = allItems.filter(i => i.id !== item.id);
      setAllItems(newItems);
      cacheManager.setLibraryItems(newItems);
    } catch (e) {
      console.error('Delete error', e);
      alert('Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCeovaDrive = async () => {
    if (!window.confirm('Are you sure you want to clear all CEOVA Drive files? This will remove all attachments from your chats in the library.')) return;

    setLoading(true);
    try {
      const ceovaItems = allItems.filter(i => {
        const isAiItem = i.source === 'ai' || i.source === 'ai_generated' || i.category === 'ai_generated' || i.category === 'action';
        return i.source !== 'gdrive' && i.source !== 'gmail' && i.source !== 'gcalendar' && !isAiItem;
      });

      for (const item of ceovaItems) {
        if (item.id.startsWith('att-')) {
          const msgId = item.id.split('-')[1];
          const { data: msg } = await supabase.from('messages').select('attachments').eq('id', msgId).single();
          if (msg && msg.attachments) {
             const newAtt = msg.attachments.filter(a => a.name !== item.name && a.url !== item.url);
             await supabase.from('messages').update({ attachments: newAtt }).eq('id', msgId);
          }
        } else if (!item.id.startsWith('aig-') && !item.id.startsWith('db-')) {
          await supabase.from('files').delete().eq('id', item.id);
        }
      }

      const newItems = allItems.filter(i => !ceovaItems.includes(i));
      setAllItems(newItems);
      cacheManager.setLibraryItems(newItems);
    } catch (e) {
      console.error('Clear ceova drive error', e);
      alert('Failed to clear CEOVA Drive');
    } finally {
      setLoading(false);
    }
  };
"""
    content = content.replace(
        'const handleOCR = async (item) => {',
        func_insert + '\n  const handleOCR = async (item) => {'
    )

    # 8. Add Clear CEOVA Drive button to header
    content = content.replace(
        '<div className="lib-header-right">',
        '''<div className="lib-header-right">
          {topTab === 'ceova' && (
             <button onClick={handleClearCeovaDrive} style={{ background: 'var(--glass)', color: '#ef4444', border: '1px solid #ef444455', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Clear CEOVA Drive</button>
          )}'''
    )

    # 9. Pass onDelete to cards in Library (replace specific instances)
    content = content.replace(
        'item={item}\n                      onClick',
        'item={item}\n                      onDelete={handleDelete}\n                      onClick'
    )
    content = content.replace(
        'item={item}\n                      onPreview',
        'item={item}\n                      onDelete={handleDelete}\n                      onPreview'
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/pages/Library.jsx')
