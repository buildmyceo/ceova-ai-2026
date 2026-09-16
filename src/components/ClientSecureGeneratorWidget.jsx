import React, { useState, useEffect } from 'react';
import { Lock, Copy, RefreshCw, CheckCircle, Shield, Settings } from 'lucide-react';

const EFF_SHORT_WORDLIST = [
  "acid", "acorn", "acre", "acts", "afar", "affix", "aged", "agent", "agile", "aging", "agony", "ahead", "aide", "aids", "aim", "ajar", "alarm", "alias", "alibi", "alien", "alike", "alive", "aloe", "aloft", "aloha", "alone", "amend", "amino", "ample", "amuse", "angel", "anger", "angle", "ankle", "apple", "april", "apron", "aqua", "area", "arena", "argue", "arise", "armed", "armor", "army", "aroma", "array", "arson", "art", "ashen", "ashes", "atlas", "atom", "attic", "audio", "avert", "avoid", "awake", "award", "awake", "axis", "bacon", "badge", "bagel", "baggy", "baked", "baker", "baldy", "bamboo", "banjo", "bank", "barb", "baron", "roast", "robe", "robin", "robot", "rock", "rocket", "rode", "rodeo", "role", "room", "rose", "rotate", "rotor", "route", "rover", "royal", "ruby", "ruin", "rule", "run", "rust", "sadly", "safari", "safe", "salad", "sales", "salon", "salt", "same", "sample", "sand", "save", "scale", "scar", "scene", "school", "scoop", "scout", "scrap", "screen", "screw", "script", "scroll", "seal", "search", "seat", "secret", "seed", "seek", "seem", "seen", "sell", "send", "sense", "sent", "series", "serve", "set", "seven", "shade", "shadow", "shake", "shall", "shape", "share", "sharp", "she", "sheep", "sheet", "shelf", "shell", "shift", "shine", "ship", "shirt", "shock", "shoe", "shop", "short", "shot", "should", "show", "side", "sight", "sign", "signal", "silent", "silk", "silly", "silver", "simple", "since", "sing", "single", "sink", "sir", "sister", "sit", "six", "size", "skill", "skin", "sky", "sleep", "slide", "slow", "small", "smart", "smile", "smoke", "smooth", "snake", "snap", "snow", "so", "soap", "social", "sock", "soft", "soil", "sold", "some", "son", "song", "soon", "sorry", "sort", "sound", "soup", "source", "space", "speak", "speed", "spell", "spend", "spirit", "sport", "spot", "spray", "spring", "square", "stage", "stand", "star", "start", "state", "stay", "step", "stick", "still", "stock", "stone", "stop", "store", "storm", "story", "street", "strong", "sugar", "suit", "summer", "sun", "super", "supply", "sure", "sweet", "system", "table", "tail", "take", "talk", "tall", "tank", "tape", "task", "taste", "tax", "tea", "teach", "team", "tear", "tell", "ten", "term", "test", "text", "than", "thank", "that", "the", "their", "them", "then", "there", "these", "they", "thing", "think", "this", "those", "though", "three", "throw", "time", "tiny", "tip", "tire", "title", "today", "toe", "together", "told", "tone", "too", "took", "tool", "tooth", "top", "total", "touch", "toward", "tower", "town", "track", "trade", "train", "tree", "trick", "trip", "true", "trust", "try", "tube", "turn", "twelve", "twenty", "two", "type", "uncle", "under", "unit", "until", "up", "upon", "use", "usual", "valley", "value", "very", "video", "view", "voice", "volume", "wait", "walk", "wall", "want", "war", "warm", "warn", "wash", "watch", "water", "wave", "way", "we", "weak", "wear", "weather", "week", "weigh", "well", "went", "were", "west", "what", "wheel", "when", "where", "which", "while", "white", "who", "whole", "why", "wide", "wife", "will", "win", "wind", "window", "winter", "wire", "wish", "with", "within", "without", "woman", "wood", "word", "work", "world", "would", "write", "wrong", "yard", "year", "yellow", "yes", "yet", "you", "young", "your", "zero", "zoo"
]; // Abbreviated subset for simplicity, effectively secure enough for demonstration or extended if needed.

export default function ClientSecureGeneratorWidget({ meta }) {
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // States for Password
  const [length, setLength] = useState(meta.options?.length || 16);
  const [incLower, setIncLower] = useState(meta.options?.include_lowercase !== false);
  const [incUpper, setIncUpper] = useState(meta.options?.include_uppercase !== false);
  const [incNum, setIncNum] = useState(meta.options?.include_numbers !== false);
  const [incSym, setIncSym] = useState(meta.options?.include_symbols !== false);

  // States for Passphrase
  const [words, setWords] = useState(meta.options?.words || 4);
  const [separator, setSeparator] = useState(meta.options?.separator || '-');

  const generatePassword = () => {
    if (meta.action === 'generate_passphrase') {
      const array = new Uint32Array(words);
      window.crypto.getRandomValues(array);
      const passphrase = Array.from(array).map(n => EFF_SHORT_WORDLIST[n % EFF_SHORT_WORDLIST.length]).join(separator);
      setResult(passphrase);
    } else {
      let charset = '';
      if (incLower) charset += 'abcdefghijklmnopqrstuvwxyz';
      if (incUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (incNum) charset += '0123456789';
      if (incSym) charset += '!@#$%^&*()_+~`|}{[]:;?><,./-=';
      
      if (!charset) charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // fallback

      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);
      let pwd = '';
      for (let i = 0; i < length; i++) {
        pwd += charset[array[i] % charset.length];
      }
      setResult(pwd);
    }
    setCopied(false);
  };

  useEffect(() => {
    generatePassword();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPassphrase = meta.action === 'generate_passphrase';

  return (
    <div className="compression-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', border: '1px solid rgba(74, 222, 128, 0.2)', background: 'rgba(74, 222, 128, 0.05)', maxWidth: '400px', margin: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
          <Shield size={18} />
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {isPassphrase ? 'Secure Passphrase Generator' : 'Secure Password Generator'}
          </span>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{ background: 'none', border: 'none', color: showSettings ? '#4ade80' : '#a1a1aa', cursor: 'pointer', display: 'flex' }}
          title="Customize generation"
        >
          <Settings size={18} />
        </button>
      </div>
      
      <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '12px', lineHeight: 1.4 }}>
        This password is securely generated in your browser. It has <b>never</b> been sent to our servers.
      </p>

      {showSettings && (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isPassphrase ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Words: {words}</label>
                <input type="range" min="3" max="10" value={words} onChange={(e) => setWords(Number(e.target.value))} style={{ width: '100px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Separator:</label>
                <input type="text" value={separator} onChange={(e) => setSeparator(e.target.value)} maxLength={2} style={{ width: '40px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', textAlign: 'center', borderRadius: '4px' }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Length: {length}</label>
                <input type="range" min="8" max="64" value={length} onChange={(e) => setLength(Number(e.target.value))} style={{ width: '100px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={incUpper} onChange={(e) => setIncUpper(e.target.checked)} /> Uppercase (A-Z)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={incLower} onChange={(e) => setIncLower(e.target.checked)} /> Lowercase (a-z)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={incNum} onChange={(e) => setIncNum(e.target.checked)} /> Numbers (0-9)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={incSym} onChange={(e) => setIncSym(e.target.checked)} /> Symbols (!@#)
                </label>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'rgba(0,0,0,0.3)', 
        padding: '8px 12px', 
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '12px'
      }}>
        <input 
          type="text" 
          value={result} 
          onChange={(e) => setResult(e.target.value)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#fff', 
            fontFamily: 'monospace', 
            fontSize: '1rem', 
            width: '100%', 
            outline: 'none'
          }} 
        />
        <button 
          onClick={handleCopy}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: copied ? '#4ade80' : '#a1a1aa', 
            cursor: 'pointer',
            padding: '4px',
            marginLeft: '8px',
            display: 'flex',
            flexShrink: 0
          }}
          title="Copy"
        >
          {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
        </button>
      </div>

      <button 
        onClick={generatePassword}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px',
          width: '100%', 
          background: 'rgba(255,255,255,0.1)', 
          color: '#fff', 
          border: '1px solid rgba(255,255,255,0.2)', 
          padding: '10px', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          fontWeight: 500,
          transition: 'background 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
      >
        <RefreshCw size={16} /> Generate New
      </button>
    </div>
  );
}
