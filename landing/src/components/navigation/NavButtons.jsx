import { FaBars, FaRegUser } from "react-icons/fa6";

function NavButtons({ onToggleNav }) {
  const btnStyles = `hover:text-red text-white transition-colors duration-300 focus`;

  return (
    <div className="flex items-center justify-between gap-7">
      <button className={`3xl:hidden ${btnStyles}`} onClick={onToggleNav}>
        <FaBars className="h-6 w-6" />
      </button>

      <a href="/login" className={`${btnStyles} flex items-center gap-2`}>
        <FaRegUser className="h-6 w-6" />
        <span className="hidden text-sm font-bold uppercase sm:inline">
          تسجيل الدخول
        </span>
      </a>
    </div>
  );
}

export default NavButtons;
