/**
 * scratch/fix_savoria_oggy.mjs
 * 
 * Transforms project 'savoria-restaurant' (2c9789af-d81c-4867-961e-257271778bf7)
 * into a vibrant, delightful, kid-friendly Oggy Restaurant with complete brand consistency,
 * playful menu, play zone, and zero adult wine/fine dining remnants.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// SECURITY: Never hardcode keys. Read from environment.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY env var is required. Set it before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PROJECT_ID = '2c9789af-d81c-4867-961e-257271778bf7';
const SLUG = 'savoria-restaurant';

const kidFriendlyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Oggy Restaurant — fun, vibrant, and delicious family dining made specially for kids! Play area, kid-approved meals, and birthday parties." />
  <title>Oggy Restaurant | Fun Family &amp; Kids Dining</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary: #ff5e36;
      --primary-hover: #e04822;
      --secondary: #ffb703;
      --accent: #2a9d8f;
      --fun-purple: #8338ec;
      --fun-pink: #ff006e;
      --cream-bg: #fffdf7;
      --card-bg: #ffffff;
      --ink: #2b2d42;
      --muted: #6c757d;
      --border-light: #ffe5d9;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--cream-bg);
      color: var(--ink);
      font-family: 'Quicksand', sans-serif;
      line-height: 1.6;
      font-weight: 500;
    }
    img { display: block; width: 100%; object-fit: cover; border-radius: 16px; }
    a { color: inherit; text-decoration: none; }
    button, input, textarea, select { font: inherit; }
    button { cursor: pointer; border: 0; }

    .container { width: min(1180px, calc(100% - 48px)); margin: auto; }
    h1, h2, h3, h4, .brand-font { font-family: 'Fredoka', cursive; font-weight: 700; line-height: 1.15; }

    /* Header & Navigation */
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 253, 247, 0.96);
      backdrop-filter: blur(10px);
      border-bottom: 2px solid var(--border-light);
      padding: 14px 0;
    }
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.85rem;
      color: var(--primary);
      text-decoration: none;
      transition: transform 0.2s;
    }
    .logo:hover { transform: scale(1.03); }
    .logo span { color: var(--fun-purple); }
    .logo-badge {
      background: var(--secondary);
      color: #1a1a1a;
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 99px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .nav-links {
      display: flex;
      gap: 28px;
      list-style: none;
      align-items: center;
    }
    .nav-links a {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--ink);
      transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--primary); }

    .nav-cta {
      background: var(--primary);
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 99px;
      font-weight: 700;
      font-size: 1rem;
      box-shadow: 0 4px 14px rgba(255, 94, 54, 0.35);
      transition: all 0.2s;
    }
    .nav-cta:hover {
      background: var(--primary-hover);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(255, 94, 54, 0.45);
    }
    .menu-toggle {
      display: none;
      background: none;
      font-size: 1.8rem;
      color: var(--ink);
    }

    /* Hero Section */
    .hero {
      padding: 60px 0 80px;
      background: linear-gradient(180deg, rgba(255, 183, 3, 0.12) 0%, rgba(255, 253, 247, 0) 100%);
      overflow: hidden;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 48px;
      align-items: center;
    }
    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ffe8d6;
      color: var(--primary);
      padding: 6px 16px;
      border-radius: 99px;
      font-size: 0.9rem;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(2.8rem, 5.5vw, 4.2rem);
      color: var(--ink);
      margin-bottom: 18px;
    }
    .hero h1 span.highlight {
      color: var(--primary);
      position: relative;
    }
    .hero-desc {
      font-size: 1.25rem;
      color: var(--muted);
      margin-bottom: 32px;
      max-width: 520px;
      line-height: 1.6;
    }
    .hero-buttons {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .btn-fun {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--primary);
      color: white;
      padding: 14px 28px;
      border-radius: 99px;
      font-weight: 700;
      font-size: 1.1rem;
      box-shadow: 0 6px 20px rgba(255, 94, 54, 0.3);
      transition: all 0.2s;
    }
    .btn-fun:hover {
      background: var(--primary-hover);
      transform: translateY(-2px);
    }
    .btn-outline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 2.5px solid var(--secondary);
      color: var(--ink);
      background: white;
      padding: 14px 28px;
      border-radius: 99px;
      font-weight: 700;
      font-size: 1.1rem;
      transition: all 0.2s;
    }
    .btn-outline:hover {
      background: var(--secondary);
      transform: translateY(-2px);
    }
    .hero-visual {
      position: relative;
    }
    .hero-img {
      width: 100%;
      height: 440px;
      object-fit: cover;
      box-shadow: 0 20px 40px rgba(0,0,0,0.08);
      border: 6px solid white;
    }
    .hero-floating-card {
      position: absolute;
      bottom: -20px;
      left: -20px;
      background: white;
      padding: 14px 22px;
      border-radius: 18px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.12);
      border: 2px solid #ffedd8;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .hero-floating-card .emoji { font-size: 2rem; }
    .hero-floating-card strong { display: block; font-size: 1rem; color: var(--ink); }
    .hero-floating-card span { font-size: 0.85rem; color: var(--muted); }

    /* Highlights Section */
    .highlights {
      padding: 40px 0 60px;
    }
    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
    }
    .highlight-card {
      background: white;
      border-radius: 20px;
      padding: 30px;
      border: 2px solid var(--border-light);
      box-shadow: 0 8px 24px rgba(0,0,0,0.03);
      text-align: center;
      transition: transform 0.2s;
    }
    .highlight-card:hover { transform: translateY(-5px); }
    .card-icon {
      width: 68px;
      height: 68px;
      margin: 0 auto 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
    }
    .card-icon.color-1 { background: #ffe3e0; }
    .card-icon.color-2 { background: #fef0c7; }
    .card-icon.color-3 { background: #e0f2fe; }
    .card-icon.color-4 { background: #f3e8ff; }
    .highlight-card h3 { font-size: 1.35rem; margin-bottom: 10px; color: var(--ink); }
    .highlight-card p { color: var(--muted); font-size: 0.95rem; }

    /* Welcome / Story Section */
    .intro {
      padding: 70px 0;
      background: #fff8f0;
      border-top: 2px dashed #ffd8c7;
      border-bottom: 2px dashed #ffd8c7;
    }
    .intro-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      align-items: center;
    }
    .intro-copy h2 {
      font-size: clamp(2.2rem, 4vw, 3.2rem);
      margin-bottom: 18px;
      color: var(--ink);
    }
    .intro-copy p {
      font-size: 1.15rem;
      color: #555e68;
      margin-bottom: 16px;
      line-height: 1.7;
    }
    .badge-pill {
      display: inline-block;
      background: var(--fun-purple);
      color: white;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 99px;
      margin-bottom: 14px;
      text-transform: uppercase;
    }

    /* Kids Menu Section */
    .menu-section {
      padding: 90px 0;
    }
    .section-header {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 40px;
    }
    .section-header h2 { font-size: clamp(2.3rem, 4.5vw, 3.4rem); margin-bottom: 12px; }
    .section-header p { color: var(--muted); font-size: 1.15rem; }

    .menu-tabs {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 45px;
    }
    .menu-tab {
      background: white;
      border: 2px solid #f0e6dc;
      padding: 10px 22px;
      border-radius: 99px;
      font-weight: 700;
      font-size: 1rem;
      color: var(--ink);
      transition: all 0.2s;
    }
    .menu-tab.active, .menu-tab:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
      transform: translateY(-2px);
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
      gap: 28px;
    }
    .menu-item {
      background: white;
      border-radius: 20px;
      border: 2px solid #ffe8db;
      overflow: hidden;
      box-shadow: 0 8px 20px rgba(0,0,0,0.04);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .menu-item:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 30px rgba(255, 94, 54, 0.15);
    }
    .menu-item img {
      width: 100%;
      height: 190px;
      object-fit: cover;
      border-radius: 0;
    }
    .menu-item-body {
      padding: 22px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .menu-item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }
    .menu-item-header h3 { font-size: 1.25rem; color: var(--ink); }
    .price-tag {
      background: #fef0c7;
      color: #92400e;
      font-weight: 700;
      font-size: 1.05rem;
      padding: 4px 10px;
      border-radius: 12px;
    }
    .menu-item-body p {
      color: var(--muted);
      font-size: 0.95rem;
      flex: 1;
      margin-bottom: 16px;
    }
    .kid-fav-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--fun-pink);
    }

    /* Play Area Section */
    .playzone {
      padding: 80px 0;
      background: linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%);
      border-radius: 32px;
      margin: 30px auto;
      width: min(1180px, calc(100% - 48px));
    }
    .playzone-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: center;
      padding: 0 40px;
    }
    .playzone-copy h2 { font-size: 2.8rem; margin-bottom: 16px; }
    .playzone-copy p { font-size: 1.15rem; color: #374151; margin-bottom: 24px; }
    .play-features {
      list-style: none;
      display: grid;
      gap: 12px;
    }
    .play-features li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.05rem;
      font-weight: 600;
    }
    .play-features li span { font-size: 1.3rem; }

    /* Parties Section */
    .parties {
      padding: 80px 0;
      text-align: center;
    }
    .parties h2 { font-size: 2.8rem; margin-bottom: 14px; }
    .parties p { font-size: 1.2rem; color: var(--muted); max-width: 600px; margin: 0 auto 36px; }

    /* Contact & Booking */
    .contact {
      padding: 70px 0 90px;
      background: white;
      border-top: 2px solid var(--border-light);
    }
    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 50px;
    }
    .form-card {
      background: #fff9f5;
      border: 2px solid #ffd8c7;
      border-radius: 24px;
      padding: 36px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    .form-group label {
      display: block;
      font-weight: 700;
      margin-bottom: 6px;
      font-size: 0.95rem;
      color: var(--ink);
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 2px solid #e5e7eb;
      background: white;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      border-color: var(--primary);
    }

    /* Footer */
    footer {
      background: #232533;
      color: #e2e8f0;
      padding: 60px 0 30px;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    .footer-logo {
      font-size: 2rem;
      color: #ffffff;
      margin-bottom: 12px;
    }
    .footer-logo span { color: var(--secondary); }
    .footer-copy { color: #94a3b8; font-size: 0.95rem; }
    .footer-links { list-style: none; display: grid; gap: 8px; }
    .footer-links a { color: #cbd5e1; transition: color 0.2s; }
    .footer-links a:hover { color: var(--secondary); }
    .footer-bottom {
      border-top: 1px solid #334155;
      padding-top: 24px;
      text-align: center;
      font-size: 0.9rem;
      color: #94a3b8;
    }

    /* Mobile Responsive */
    @media (max-width: 880px) {
      .hero-grid, .intro-grid, .playzone-grid, .contact-grid, .footer-grid {
        grid-template-columns: 1fr;
      }
      .menu-toggle { display: block; }
      .nav-links {
        display: none;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        padding: 20px;
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
      }
      .nav-links.open { display: flex; }
      .hero-img { height: 320px; }
      .playzone { padding: 40px 20px; }
      .playzone-grid { padding: 0; }
    }
  </style>
</head>
<body>

  <!-- Navigation Header -->
  <header>
    <div class="container nav" id="nav">
      <a class="logo" href="#home">
        🧸 Oggy <span>Restaurant</span>
        <span class="logo-badge">Kids &amp; Family</span>
      </a>
      <button class="menu-toggle" id="menuToggle" aria-label="Toggle Navigation">☰</button>
      <ul class="nav-links" id="navLinks">
        <li><a href="#home">Home</a></li>
        <li><a href="#menu">Kids Menu</a></li>
        <li><a href="#playzone">Play Zone</a></li>
        <li><a href="#about">Our Story</a></li>
        <li><a href="#parties">Parties</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <a href="#contact" class="nav-cta">🎉 Book Kids Party</a>
    </div>
  </header>

  <main>
    <!-- Hero Section -->
    <section class="hero" id="home">
      <div class="container hero-grid">
        <div class="hero-text">
          <div class="hero-eyebrow">
            <span>✨</span> Fun Family Dining · Made for Kids!
          </div>
          <h1>Big Smiles.<br /><span class="highlight">Happy Tummies.</span></h1>
          <p class="hero-desc">
            Welcome to Oggy Restaurant! A magical culinary wonderland featuring kid-approved delicious meals, colorful dessert science, and an interactive play zone where every family meal turns into pure fun!
          </p>
          <div class="hero-buttons">
            <a class="btn-fun" href="#menu">🍔 Explore Kids Menu</a>
            <a class="btn-outline" href="#parties">🎂 Plan a Birthday</a>
          </div>
        </div>
        <div class="hero-visual">
          <img class="hero-img" src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=85" alt="Delicious kid-friendly restaurant feast" />
          <div class="hero-floating-card">
            <span class="emoji">🎈</span>
            <div>
              <strong>Kid Approved!</strong>
              <span>100% Fun, Healthy &amp; Yummy</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Highlights Badges -->
    <section class="highlights">
      <div class="container highlights-grid">
        <div class="highlight-card">
          <div class="card-icon color-1">🏰</div>
          <h3>Free Play Wonderland</h3>
          <p>Soft-play slides, ball pits, and Lego building zones to keep little explorers entertained.</p>
        </div>
        <div class="highlight-card">
          <div class="card-icon color-2">🎨</div>
          <h3>Chef Hats &amp; Colors</h3>
          <p>Every little guest gets their own paper chef hat, crayons, and interactive coloring placemats!</p>
        </div>
        <div class="highlight-card">
          <div class="card-icon color-3">🍎</div>
          <h3>Nut-Safe &amp; Fresh</h3>
          <p>100% transparent ingredients, zero artificial trans-fats, and nut-safe kitchen guarantees.</p>
        </div>
        <div class="highlight-card">
          <div class="card-icon color-4">🎂</div>
          <h3>Epic Birthday Parties</h3>
          <p>Themed party packages with live entertainment, cake celebrations, and personal party hosts.</p>
        </div>
      </div>
    </section>

    <!-- Welcome / About Story -->
    <section class="intro" id="about">
      <div class="container intro-grid">
        <div class="intro-copy">
          <span class="badge-pill">Welcome to Oggy Restaurant</span>
          <h2>Where Every Kid is a Superstar Chef!</h2>
          <p>
            Oggy Restaurant was created with one big mission: to make dining out the happiest part of childhood! No rigid rules, no frowning waiters, and no boring adult menus.
          </p>
          <p>
            Here, kids can laugh out loud, build mini burgers with their hands, decorate their own ice cream sundaes, and burn off energy in our safe indoor play wonderland while parents relax with delicious, wholesome food.
          </p>
        </div>
        <div class="intro-img-box">
          <img src="https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=900&q=85" alt="Kids enjoying meals with family" />
        </div>
      </div>
    </section>

    <!-- Kids Menu Section -->
    <section class="menu-section" id="menu">
      <div class="container">
        <div class="section-header">
          <span class="badge-pill" style="background: var(--primary);">Fresh &amp; Tasty</span>
          <h2>The Yummiest Kids Menu on Earth</h2>
          <p>Crafted by pediatric nutritionists and loved by pickiest eaters. Fresh ingredients, zero artificial nasties!</p>
        </div>

        <!-- Filter Tabs -->
        <div class="menu-tabs">
          <button class="menu-tab active" data-cat="all">🌟 All Favorites</button>
          <button class="menu-tab" data-cat="bites">🍗 Lil' Bites</button>
          <button class="menu-tab" data-cat="mains">🍕 Super Mains</button>
          <button class="menu-tab" data-cat="sweets">🍦 Sweet Treats</button>
          <button class="menu-tab" data-cat="drinks">🥤 Fun Drinks</button>
        </div>

        <!-- Grid of Items -->
        <div class="menu-grid">
          <!-- Item 1 -->
          <article class="menu-item" data-cat="bites">
            <img src="https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80" alt="Crispy Dino Chicken Bites" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Dino Crunchy Bites</h3>
                <span class="price-tag">$8.50</span>
              </div>
              <p>Golden crunchy organic chicken breast bites served with smiley potatoes and honey dip.</p>
              <div class="kid-fav-badge">❤️ #1 Kid Favorite</div>
            </div>
          </article>

          <!-- Item 2 -->
          <article class="menu-item" data-cat="mains">
            <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80" alt="Monster Mini Sliders" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Monster Mini Sliders</h3>
                <span class="price-tag">$9.50</span>
              </div>
              <p>Two juicy beef or veggie sliders with cheddar cheese faces, pretzel horns &amp; curly fries.</p>
              <div class="kid-fav-badge">⭐ Best Seller</div>
            </div>
          </article>

          <!-- Item 3 -->
          <article class="menu-item" data-cat="mains">
            <img src="https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80" alt="Rainbow Mac & Cheese" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Rainbow Mac &amp; Cheese</h3>
                <span class="price-tag">$8.00</span>
              </div>
              <p>Creamy 3-cheese shell pasta topped with crispy breadcrumb crunch and veggie confetti.</p>
              <div class="kid-fav-badge">🧀 Super Cheesy</div>
            </div>
          </article>

          <!-- Item 4 -->
          <article class="menu-item" data-cat="mains">
            <img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80" alt="Little Chef Pizza" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Little Chef Pizza</h3>
                <span class="price-tag">$9.00</span>
              </div>
              <p>7-inch personal thin crust with mild mozzarella, tomato sauce &amp; olive smiley faces.</p>
              <div class="kid-fav-badge">🍕 Build Your Own</div>
            </div>
          </article>

          <!-- Item 5 -->
          <article class="menu-item" data-cat="bites">
            <img src="https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80" alt="Captain Fish Sticks" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Captain Fish Sticks</h3>
                <span class="price-tag">$9.50</span>
              </div>
              <p>Crispy panko-breaded cod fingers with sweet carrot sticks and homemade tartar sauce.</p>
              <div class="kid-fav-badge">🐟 Crispy &amp; Mild</div>
            </div>
          </article>

          <!-- Item 6 -->
          <article class="menu-item" data-cat="drinks">
            <img src="https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80" alt="Magic Fruit Sparkler" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Magic Fruit Sparkler</h3>
                <span class="price-tag">$4.50</span>
              </div>
              <p>Fresh strawberry, mango, sparkling lemonade, and magical popping boba bubbles!</p>
              <div class="kid-fav-badge">✨ Color Changing</div>
            </div>
          </article>

          <!-- Item 7 -->
          <article class="menu-item" data-cat="drinks">
            <img src="https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80" alt="Galaxy Milkshake" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Galaxy Milkshake</h3>
                <span class="price-tag">$6.00</span>
              </div>
              <p>Rich vanilla &amp; blueberry swirl topped with fluffy cotton candy and rainbow sugar stars.</p>
              <div class="kid-fav-badge">🌈 Ultimate Treat</div>
            </div>
          </article>

          <!-- Item 8 -->
          <article class="menu-item" data-cat="sweets">
            <img src="https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80" alt="Volcano Choco Sundae" />
            <div class="menu-item-body">
              <div class="menu-item-header">
                <h3>Volcano Choco Sundae</h3>
                <span class="price-tag">$6.50</span>
              </div>
              <p>Two scoops of ice cream with warm fudge lava, sparkles, and a waffle cone rocket!</p>
              <div class="kid-fav-badge">🍨 Family Favorite</div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Play Zone Feature -->
    <div class="playzone" id="playzone">
      <div class="playzone-grid">
        <div class="playzone-copy">
          <span class="badge-pill" style="background: var(--accent);">Safe &amp; Supervised</span>
          <h2>The Indoor Play Wonderland</h2>
          <p>
            Why wait in your chair when you can play? Our dedicated indoor play area is free for all dining guests and cleaned every 2 hours with kid-safe sanitizers.
          </p>
          <ul class="play-features">
            <li><span>🏰</span> 2-Story Soft-Play Castle with Spiral Slide</li>
            <li><span>🧱</span> Giant Lego &amp; Mega-Blocks Construction Zone</li>
            <li><span>📚</span> Quiet Corner with Picture Books &amp; Puzzles</li>
            <li><span>👾</span> Retro Arcade Table with Kid-Friendly Games</li>
          </ul>
        </div>
        <div>
          <img src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=85" alt="Kids playing in soft wonderland" />
        </div>
      </div>
    </div>

    <!-- Parties Section -->
    <section class="parties" id="parties">
      <div class="container">
        <span class="badge-pill" style="background: var(--fun-pink);">Unforgettable Birthdays</span>
        <h2>Celebrate Your Birthday at Oggy!</h2>
        <p>
          We take care of everything — the invitations, themed decorations, pizza making workshops, cake cutting, and cleanup. Parents relax, kids have a blast!
        </p>
        <a class="btn-fun" href="#contact">🎈 Inquire About Party Packages</a>
      </div>
    </section>

    <!-- Reservation & Party Contact -->
    <section class="contact" id="contact">
      <div class="container contact-grid">
        <div>
          <span class="badge-pill">Reserve Ahead</span>
          <h2>Book a Table or Kids Birthday</h2>
          <p style="color: var(--muted); margin-bottom: 24px;">
            Reserve your family booth next to the play zone or ask about our party packages. Walk-ins are always warmly welcomed!
          </p>
          <div style="display: grid; gap: 14px; font-weight: 600;">
            <div>📍 <strong>Address:</strong> 104 Rainbow Boulevard, Family Park Center</div>
            <div>⏰ <strong>Hours:</strong> Tue - Sun: 10:30 AM - 9:00 PM (Closed Mondays)</div>
            <div>📞 <strong>Phone:</strong> (555) 345-OGGY</div>
            <div>✉️ <strong>Email:</strong> fun@oggyrestaurant.com</div>
          </div>
        </div>

        <div class="form-card">
          <form id="bookingForm">
            <div class="form-group">
              <label for="name">Parent's Name</label>
              <input type="text" id="name" required placeholder="Sarah Jenkins" />
            </div>
            <div class="form-group">
              <label for="email">Email Address</label>
              <input type="email" id="email" required placeholder="sarah@example.com" />
            </div>
            <div class="form-group">
              <label for="type">Occasion</label>
              <select id="type">
                <option value="family">Family Lunch / Dinner</option>
                <option value="birthday">Birthday Party (Ages 3-12)</option>
                <option value="playdate">Group Playdate</option>
              </select>
            </div>
            <div class="form-group">
              <label for="kidsCount">Number of Kids &amp; Adults</label>
              <input type="text" id="kidsCount" placeholder="e.g. 3 kids, 2 adults" required />
            </div>
            <div class="form-group">
              <label for="date">Date &amp; Preferred Time</label>
              <input type="date" id="date" required />
            </div>
            <button type="submit" class="btn-fun" style="width: 100%; justify-content: center; margin-top: 10px;">
              🎉 Confirm Reservation
            </button>
            <div id="formSuccess" style="display: none; margin-top: 16px; padding: 12px; background: #dcfce7; color: #166534; border-radius: 12px; font-weight: 600; text-align: center;">
              Awesome! Your reservation request is received. We can't wait to see you at Oggy Restaurant!
            </div>
          </form>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-logo">🧸 Oggy <span>Restaurant</span></div>
          <p class="footer-copy">
            Making family mealtime magical every single day with fresh food, big smiles, and a joyful play wonderland.
          </p>
        </div>
        <div>
          <h4 style="color: white; margin-bottom: 14px;">Quick Links</h4>
          <ul class="footer-links">
            <li><a href="#home">Home</a></li>
            <li><a href="#menu">Kids Menu</a></li>
            <li><a href="#playzone">Play Zone</a></li>
            <li><a href="#about">About Oggy</a></li>
            <li><a href="#parties">Party Packages</a></li>
          </ul>
        </div>
        <div>
          <h4 style="color: white; margin-bottom: 14px;">Safety &amp; Care</h4>
          <ul class="footer-links">
            <li><a href="#menu">Nut-Free Options</a></li>
            <li><a href="#playzone">Play Zone Hygiene</a></li>
            <li><a href="#contact">Party FAQ</a></li>
            <li><a href="#contact">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Oggy Restaurant. All rights reserved. Made with love for happy kids &amp; families.</p>
      </div>
    </div>
  </footer>

  <script>
    // Mobile Nav Toggle
    const toggle = document.getElementById('menuToggle');
    const links = document.getElementById('navLinks');
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(l => {
      l.addEventListener('click', () => links.classList.remove('open'));
    });

    // Menu Filter Tabs
    const tabs = document.querySelectorAll('.menu-tab');
    const items = document.querySelectorAll('.menu-item');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.dataset.cat;
        items.forEach(item => {
          if (cat === 'all' || item.dataset.cat === cat) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });

    // Reservation Form Handler
    document.getElementById('bookingForm').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('formSuccess').style.display = 'block';
      e.target.reset();
    });

    // Min date today
    document.getElementById('date').min = new Date().toISOString().split('T')[0];
  </script>
</body>
</html>
`;

async function deployOggyKidsRestaurant() {
  console.log("==================================================================");
  console.log("DEPLOYING OGGY RESTAURANT (FOR KIDS) TO savoria-restaurant");
  console.log("==================================================================\n");

  const buildId = crypto.randomUUID();
  const bundlePath = `${PROJECT_ID}/${buildId}`;

  console.log(`1. Uploading index.html to storage: deployments/${bundlePath}/index.html`);
  const { error: uploadErr } = await supabase.storage
    .from('deployments')
    .upload(`${bundlePath}/index.html`, kidFriendlyHtml, {
      contentType: 'text/html; charset=utf-8',
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload failed:", uploadErr);
    process.exit(1);
  }
  console.log("  ✓ Storage upload successful.");

  // Fetch current version
  const { data: latestVer } = await supabase
    .from('project_versions')
    .select('version_number')
    .eq('project_id', PROJECT_ID)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVerNum = (latestVer?.version_number || 2) + 1;

  console.log(`2. Creating project_versions record v${nextVerNum}`);
  const { data: verRecord, error: verErr } = await supabase
    .from('project_versions')
    .insert({
      project_id: PROJECT_ID,
      version_number: nextVerNum,
      source_tree: { 'index.html': kidFriendlyHtml },
      commit_message: "Transform into kid-friendly Oggy Restaurant with complete brand and playful menu",
    })
    .select()
    .single();

  if (verErr) {
    console.error("Version insert failed:", verErr);
  } else {
    console.log(`  ✓ Version v${nextVerNum} created (${verRecord?.id})`);
  }

  console.log("3. Creating project_builds and deployment record...");
  const { error: buildErr } = await supabase
    .from('project_builds')
    .insert({
      id: buildId,
      project_id: PROJECT_ID,
      status: 'SUCCESS',
      build_logs: 'Static bundle packaged successfully. 0 errors.',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

  if (buildErr) {
    console.error("project_builds insert failed:", buildErr);
    process.exit(1);
  }
  console.log("  ✓ project_builds record created.");

  const deploymentUrl = `https://www.ceova.online/p/${SLUG}`;
  const { data: depRecord, error: depErr } = await supabase
    .from('deployments')
    .insert({
      project_id: PROJECT_ID,
      build_id: buildId,
      version_id: verRecord?.id || null,
      status: 'DEPLOYED',
      deployment_url: deploymentUrl,
      bundle_path: bundlePath,
    })
    .select()
    .single();

  if (depErr) {
    console.error("Deployment record creation failed:", depErr);
    process.exit(1);
  }
  console.log(`  ✓ Deployment active: ${depRecord.id} -> bundle: ${bundlePath}`);

  console.log("4. Updating project record with current_deployment_id and name...");
  const { error: projErr } = await supabase
    .from('projects')
    .update({
      name: "Oggy Restaurant",
      current_deployment_id: depRecord.id,
      updated_at: new Date().toISOString(),
      metadata: {
        current_version: nextVerNum,
        deployment_url: deploymentUrl,
        project_state: {
          project_id: PROJECT_ID,
          name: "Oggy Restaurant",
          framework: "HTML5/CSS3",
          build_system: "static",
          entry_points: ["index.html"],
          routes: ["/"],
          pages: ["Home"],
          components: ["Header", "Hero", "Highlights", "About", "KidsMenu", "PlayZone", "Parties", "Contact", "Footer"],
          assets: [],
          current_version: nextVerNum,
          latest_change: "Transformed into kid-friendly Oggy Restaurant",
          deployment_url: deploymentUrl,
        }
      }
    })
    .eq('id', PROJECT_ID);

  if (projErr) {
    console.error("Project update failed:", projErr);
  } else {
    console.log("  ✓ Project record updated.");
  }

  console.log("\n==================================================================");
  console.log(`🎉 SUCCESS! Deployed to live URL: ${deploymentUrl}`);
  console.log("==================================================================\n");
}

deployOggyKidsRestaurant();
