export const GA_MEASUREMENT_ID = 'G-ZDE09SGVV3';

// Send a pageview to GA4
export const pageview = (url) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_location: url,
    });
  }
};

// Send a custom event to GA4
export const event = ({ action, category, label, value }) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value,
    });
  }
};
