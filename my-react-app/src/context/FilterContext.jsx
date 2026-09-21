import { createContext, useContext, useState } from 'react';

const FilterContext = createContext(null);

const today = new Date().toISOString().split('T')[0];
const last7 = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState({
    project_id: '',
    city_id: '',
    zone_id: '',
    ward_id: '',
    street_id: '',
    dateFrom: last7,
    dateTo: today,
    datePreset: 'last7',
  });

  const updateFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Clear child filters when parent changes
      if (key === 'project_id') { next.city_id = ''; next.zone_id = ''; next.ward_id = ''; next.street_id = ''; }
      if (key === 'city_id') { next.zone_id = ''; next.ward_id = ''; next.street_id = ''; }
      if (key === 'zone_id') { next.ward_id = ''; next.street_id = ''; }
      if (key === 'ward_id') { next.street_id = ''; }
      return next;
    });
  };

  const applyDatePreset = (preset) => {
    const now = new Date();
    const t = now.toISOString().split('T')[0];
    let from = t;
    if (preset === 'today') from = t;
    else if (preset === 'yesterday') {
      const y = new Date(now - 864e5).toISOString().split('T')[0];
      from = y;
      setFilters(p => ({ ...p, dateFrom: y, dateTo: y, datePreset: preset }));
      return;
    }
    else if (preset === 'last7') from = new Date(now - 7 * 864e5).toISOString().split('T')[0];
    else if (preset === 'last30') from = new Date(now - 30 * 864e5).toISOString().split('T')[0];
    setFilters(p => ({ ...p, dateFrom: from, dateTo: t, datePreset: preset }));
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilter, applyDatePreset }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
