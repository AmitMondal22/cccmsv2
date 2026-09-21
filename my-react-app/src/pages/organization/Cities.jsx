import { OrgPage } from './OrgPage.jsx';
import { getCities, createCity, updateCity, getProjects } from '../../api/organization.api.js';
export default function Cities() {
  return (
    <OrgPage title="Cities" fetchFn={getCities} createFn={createCity} updateFn={updateCity}
      parentLabel="Project" parentFetchFn={getProjects} parentKey="project_id"
      columns={[
        { key: 'name', label: 'Name', render: r => <strong>{r.name}</strong> },
        { key: 'state', label: 'State', dim: true },
        { key: '_project', label: 'Project', dim: true, render: r => r.project?.name || '—' },
        { key: 'timezone', label: 'Timezone', dim: true },
        { key: 'status', label: 'Status', render: r => <span className={`badge badge-${r.status === 'active' ? 'online' : 'offline'}`}>{r.status}</span> },
      ]}
      formFields={[
        { key: 'name', label: 'City Name', required: true },
        { key: 'state', label: 'State' },
        { key: 'country', label: 'Country' },
        { key: 'timezone', label: 'Timezone', placeholder: 'Asia/Kolkata' },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
      ]}
      defaultForm={{ project_id: '', name: '', state: '', country: 'India', timezone: 'Asia/Kolkata', latitude: '', longitude: '' }}
    />
  );
}
