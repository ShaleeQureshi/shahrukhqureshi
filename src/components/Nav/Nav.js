import { NavLink, Link } from 'react-router-dom';
import './Nav.css';

export default function Nav() {
  return (
    <nav className="site-nav">
      <Link to="/" className="brand">Shahrukh Qureshi</Link>
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        home
      </NavLink>
      <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>
        about
      </NavLink>
      <NavLink to="/projects" className={({ isActive }) => (isActive ? 'active' : '')}>
        work
      </NavLink>
      <NavLink to="/contact" className={({ isActive }) => (isActive ? 'active' : '')}>
        contact
      </NavLink>
    </nav>
  );
}
