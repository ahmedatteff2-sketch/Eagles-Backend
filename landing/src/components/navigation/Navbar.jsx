import { useEffect, useState } from "react";
import Logo from "../logo/Logo";
import NavLinks from "./NavLinks";
import NavButtons from "./NavButtons";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import {useLocation} from 'react-router-dom'

function Navigation() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stickyNav, setStickyNav] = useState(false);

const location= useLocation()

const isSignupPage = location.pathname==="/SignUp"
const isLoginPage = location.pathname==="/Login"
const isProfilePage = location.pathname.startsWith("/Profile")
const isDashboardPage = location.pathname==="/Dashboard"
const isEditMemberPage = location.pathname.startsWith("/EditMember")
const isChartsPage = location.pathname==="/Charts"
const isProtiensPage = location.pathname==="/protiens"

  useEffect(function () {
    function stickNav() {
      window.scrollY > 150 ? setStickyNav(true) : setStickyNav(false);
    }

    window.addEventListener("scroll", stickNav);

    console.log("isProfilePage",isProfilePage);
    return () => window.removeEventListener("scroll", stickNav);
    
  }, []);

  useEffect(
    function () {
      if (isNavOpen || isSidebarOpen) document.body.style.overflow = "hidden";
      else document.body.style.overflow = "visible";
    },
    [isNavOpen, isSidebarOpen],
  );

  function handleToggleNav() {
    setIsNavOpen(!isNavOpen);
  }

  function handleToggleSidebar() {
    setIsSidebarOpen(!isSidebarOpen);
  }

  return (
    <>
 <nav
  className={`${
    stickyNav ? "sticky top-0 bg-gray-600" : "relative"
  } z-50 flex items-center justify-between px-8 py-3 h-24 ${isSignupPage ? "bg-black" : ""} ${isLoginPage ? "bg-black" : ""} ${isProtiensPage ? "bg-black" : ""} ${isProfilePage ? "bg-black" : ""} ${isDashboardPage ? "bg-black" : ""} ${isEditMemberPage ? "bg-black" : ""} ${isChartsPage ? "bg-black" : ""}`}
>
         <Logo size="w-auto h-20" />

        <NavLinks styles="3xl:flex hidden gap-6 font-medium text-white" />

        <NavButtons
          onToggleNav={handleToggleNav}
          onToggleSidebar={handleToggleSidebar}
        />
      </nav>

      <MobileNav isNavOpen={isNavOpen} onToggleNav={handleToggleNav} />

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        handleToggleSidebar={handleToggleSidebar}
      />
    </>
  );
}

export default Navigation;
