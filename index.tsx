/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- SVG Icon Components ---

// Icono: Menú de navegación
const MenuIcon = ({ className = '' }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

// Icono: Perfil de usuario
const UserProfileIcon = ({ className = '' }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
);


// Icono: Flecha hacia abajo
const ChevronDownIcon = ({ className = '' }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
);

// Icono: Check de validación
const ValidatedCheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#2B388F"/>
      <path d="M8 12.5L11 15.5L16 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// Icono: Credencial/Turno (No tenés turnos programados)
const AppointmentTicketIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 6H12C9.79086 6 8 7.79086 8 10V15C9.65685 15 11 16.3431 11 18C11 19.6569 9.65685 21 8 21V26C8 28.2091 9.79086 30 12 30H28C30.2091 30 32 28.2091 32 26V21C30.3431 21 29 19.6569 29 18C29 16.3431 30.3431 15 32 15V10C32 7.79086 30.2091 6 28 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="20" y="22" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="bold" fontFamily="sans-serif">01</text>
    </svg>
);

// Icono: Elecciones
const ElectionsIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 33.75H27.5C28.8807 33.75 30 32.6307 30 31.25V21.25H10V31.25C10 32.6307 11.1193 33.75 12.5 33.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M30 21.25H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23.75 6.25H16.25L13.75 12.5H26.25L23.75 6.25Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17.5 12.5V17.5C17.5 18.3284 18.1716 19 19 19H21C21.8284 19 22.5 18.3284 22.5 17.5V12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// Icono: Documentos
const DocumentosIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 10C7.34315 10 6 11.3431 6 13V19C6 20.6569 7.34315 22 9 22H23C24.6569 22 26 20.6569 26 19V13C26 11.3431 24.6569 10 23 10H9Z" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M13 14H10V18H13V14Z" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M16 14H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M16 18H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
);

// Icono: Vehículos
const VehiclesIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 21H5C4.44772 21 4 20.5523 4 20V15.5C4 13.1423 5.48792 11.112 7.64833 10.264C9.20833 9.64 11.1389 9 13.5 9H18.5C22.5 9 25.5 11 27 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M28 17.5V20C28 20.5523 27.5523 21 27 21H25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="21" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <circle cx="21" cy="21" r="3" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
);

// Icono: Trabajo
const WorkIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="10" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 10V8C20 6.89543 19.1046 6 18 6H14C12.8954 6 12 6.89543 12 8V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// Icono: Salud
const HealthIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.7554 14.3919L16.0001 22.8838L8.24472 14.3919C6.62963 12.5702 6.7731 9.90525 8.58495 8.23232C10.3968 6.55938 13.084 6.68541 14.7554 8.56381L16.0001 9.9419L17.2447 8.56381C18.9161 6.68541 21.6033 6.55938 23.4151 8.23232C25.227 9.90525 25.3705 12.5702 23.7554 14.3919Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
);

// Icono: Cobros
const PaymentsIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="9" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M18 13.5C18 12.6716 17.3284 12 16.5 12H15C14.1716 12 13.5 12.6716 13.5 13.5V13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M14.5 18.5C14.5 19.3284 15.1716 20 16 20H17.5C18.3284 20 19 19.3284 19 18.5V18.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M16 10V22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
);

// Icono: Trámites
const ProceduresIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 28H8C6.89543 28 6 27.1046 6 26V6C6 4.89543 6.89543 4 8 4H24C25.1046 4 26 4.89543 26 6V26C26 27.1046 25.1046 28 24 28Z" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M11 12H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M11 17H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M11 22H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
);

// Icono: Turnos
const AppointmentsIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 7H8C6.34315 7 5 8.34315 5 10V13C6.65685 13 8 14.3431 8 16C8 17.6569 6.65685 19 5 19V22C5 23.6569 6.34315 25 8 25H24C25.6569 25 27 23.6569 27 22V19C25.3431 19 24 17.6569 24 16C24 14.3431 25.3431 13 27 13V10C27 8.34315 25.6569 7 24 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="16" y="20" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold" fontFamily="sans-serif">01</text>
    </svg>
);

// Icono: Hijos
const ChildrenIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="9" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M15 22H7C7 19.2386 9.23858 17 12 17C14.7614 17 17 19.2386 17 22H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="21" cy="9" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M25 22H17C17 19.2386 19.2386 17 22 17C24.7614 17 27 19.2386 27 22H25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
    </svg>
);

// Icono: Calendario
const CalendarIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8.75" y="11.25" width="22.5" height="20" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8.75 17.5H31.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M15 9V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M25 9V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <rect x="14.5" y="21.5" width="3" height="3" rx="0.5" fill="currentColor"/>
        <rect x="18.5" y="21.5" width="3" height="3" rx="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
        <rect x="22.5" y="21.5" width="3" height="3" rx="0.5" fill="currentColor"/>
    </svg>
);


// Icono: Notificación de perfil
const NotificationIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 14C18.3431 14 17 15.3431 17 17C17 18.6569 18.3431 20 20 20C21.6569 20 23 18.6569 23 17C23 15.3431 21.6569 14 20 14Z" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M26 25C26 21.6863 23.3137 19 20 19C16.6863 19 14 21.6863 14 25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M30 18C30 23.5228 25.5228 28 20 28C14.4772 28 10 23.5228 10 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
);


// --- Profile Dropdown Component ---
// Fix: Add types to `forwardRef` to correctly type the forwarded ref.
const ProfileDropdown = forwardRef<HTMLDivElement, {}>((props, ref) => (
  <div className="profile-dropdown" ref={ref}>
    <div className="dropdown-user-info">
      <h4>León Iván Gastón IRUSTA</h4>
      <p>20-41492007-2</p>
      <div className="dropdown-validation">
        <span>Validado Nivel 3</span>
        <ValidatedCheckIcon />
      </div>
    </div>
    <div className="dropdown-links">
      <a href="#">Mi perfil</a>
      <a href="#">Hijos/as asociados</a>
      <a href="#">Suscribir servicios</a>
      <a href="#">Configurar mi cuenta</a>
      <a href="#">Seguridad</a>
      <a href="#">Términos y Condiciones</a>
    </div>
    <div className="dropdown-footer">
      <a href="#">Cerrar la sesión</a>
    </div>
  </div>
));


// --- Main App Component ---
const App = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileButtonRef.current && !profileButtonRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const gridItems = [
    { label: 'Documentos', icon: DocumentosIcon },
    { label: 'Vehículos', icon: VehiclesIcon },
    { label: 'Trabajo', icon: WorkIcon },
    { label: 'Salud', icon: HealthIcon },
    { label: 'Cobros', icon: PaymentsIcon },
    { label: 'Trámites', icon: ProceduresIcon },
    { label: 'Turnos', icon: AppointmentsIcon },
    { label: 'Hijos', icon: ChildrenIcon },
  ];

  return (
    <div className="app-wrapper">
      <header className="header" aria-label="Main header">
        <button aria-label="Open menu">
            <MenuIcon />
        </button>
        <div className="header-logo">
          <span>mi</span>Argentina
        </div>
        <button 
          ref={profileButtonRef}
          className="header-profile"
          onClick={() => setDropdownOpen(!isDropdownOpen)}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <UserProfileIcon />
          <ChevronDownIcon className="chevron-icon" />
        </button>
      </header>
      
      {isDropdownOpen && <ProfileDropdown ref={dropdownRef} />}

      <main className="main-content">
        <section className="welcome-section" aria-labelledby="welcome-heading">
          <h1 id="welcome-heading">¡Hola León Iván Gastón!</h1>
          <p>Gestioná trámites, sacá turnos, accedé a tus credenciales y recibí información personalizada.</p>
        </section>

        <section className="card" aria-label="Turnos programados">
          <div className="card-icon">
             <AppointmentTicketIcon />
          </div>
          <div className="card-content">
            <p>No tenés turnos programados</p>
            <button className="card-button">Sacar turno</button>
          </div>
        </section>

        <section className="card elections-card" aria-labelledby="elections-heading">
          <div className="card-icon">
            <ElectionsIcon />
          </div>
          <div className="divider"></div>
          <div className="card-content">
            <h3 id="elections-heading">Elecciones 2025</h3>
            <p>Conocé donde votar en las próximas elecciones</p>
          </div>
        </section>

        <section className="grid-section" aria-labelledby="grid-heading">
          <h2 id="grid-heading">¿Qué necesitás hoy?</h2>
          <div className="grid-menu">
            {gridItems.map((item, index) => (
              <button key={index} className="grid-item">
                {React.createElement(item.icon)}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="info-banner holiday" aria-labelledby="holiday-heading">
            <div className="card-icon">
                <CalendarIcon />
            </div>
            <div className="card-content">
                <p id="holiday-heading">Próximo feriado</p>
                <strong>12 de Octubre</strong>
                <p>12 de octubre. Día de la raza.</p>
            </div>
        </section>

        <section className="info-banner profile" aria-label="Actualizar perfil">
            <div className="card-icon">
                <NotificationIcon />
            </div>
            <div className="card-content">
                <strong>Mantené tu perfil actualizado</strong>
            </div>
        </section>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
