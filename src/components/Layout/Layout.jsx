import { Outlet } from 'react-router-dom';
import Nav from '../Nav/Nav';
import './Layout.css';

export default function Layout() {
  return (
    <>
      <Nav />
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
}
