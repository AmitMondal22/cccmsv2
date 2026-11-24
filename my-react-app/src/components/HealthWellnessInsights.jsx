import React from 'react';

export default function HealthWellnessInsights() {
  const cards = [
    {
      id: 1,
      title: 'Balanced Diet: The Key to Everyday Wellness',
      description: 'Learn how a balanced diet improves energy, immunity and overall health.',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80',
      link: '#',
    },
    {
      id: 2,
      title: 'Simple Daily Habits for Better Health',
      description: 'Easy, science-backed habits to stay active, fit and stress-free.',
      image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
      link: '#',
    },
    {
      id: 3,
      title: 'Foods That Naturally Boost Immunity',
      description: 'Add these nutrient-rich foods to support a stronger immune system.',
      image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=400&q=80',
      link: '#',
    },
  ];

  return (
    <section style={styles.section}>
      {/* Title & Green Indicator Bar */}
      <div style={styles.header}>
        <h2 style={styles.heading}>Health &amp; Wellness Insights</h2>
        <div style={styles.indicator} />
      </div>

      {/* Fixed 3-Card Grid */}
      <div style={styles.grid}>
        {cards.map((card) => (
          <div key={card.id} style={styles.card}>
            {/* Left Fixed Thumbnail Image */}
            <div style={styles.imageContainer}>
              <img
                src={card.image}
                alt={card.title}
                style={styles.image}
                loading="lazy"
              />
            </div>

            {/* Right Fixed Content */}
            <div style={styles.content}>
              <h3 style={styles.cardTitle}>{card.title}</h3>
              <p style={styles.cardDesc}>{card.description}</p>
              <a href={card.link} style={styles.readMore}>
                Read More <span style={styles.arrow}>&rarr;</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Completely Fixed, Self-Contained Inline Styles ─────────────────────────
const styles = {
  section: {
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '24px 16px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: '20px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0a1629',
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em',
    lineHeight: '1.2',
  },
  indicator: {
    width: '40px',
    height: '4px',
    backgroundColor: '#22c55e', // Fixed Green Indicator
    borderRadius: '4px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '20px',
    alignItems: 'stretch',
  },
  card: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 14px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    boxSizing: 'border-box',
    minHeight: '118px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  imageContainer: {
    width: '96px',
    height: '96px',
    minWidth: '96px',
    maxWidth: '96px',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '5px',
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '14.5px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    lineHeight: '1.28',
    letterSpacing: '-0.01em',
  },
  cardDesc: {
    fontSize: '12.5px',
    color: '#64748b',
    margin: 0,
    lineHeight: '1.42',
  },
  readMore: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#16a34a', // Exact Green Color
    textDecoration: 'none',
    marginTop: '2px',
    width: 'fit-content',
    cursor: 'pointer',
  },
  arrow: {
    fontSize: '14px',
    lineHeight: '1',
  },
};
