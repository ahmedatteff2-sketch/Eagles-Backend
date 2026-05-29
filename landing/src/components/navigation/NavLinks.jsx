import { Link } from "react-router-dom";

const linkStyles = "hover:text-red focus:text-red focus";
// ring-offset-gray-600

function NavLinks({ onToggleNav, styles }) {
  return (
    <ul className={styles}>
      <li>
        <Link to="/" className={linkStyles} onClick={onToggleNav}>
          الرئيسية
        </Link>
      </li>
      <li>
        <Link to="/about" className={linkStyles} onClick={onToggleNav}>
          من نحن
        </Link>
      </li>
      {/* <li>
        <Link to="/gallery" className={linkStyles} onClick={onToggleNav}>
          معرض الصور
        </Link>
      </li> */}
      <li>
        <Link to="/pricing" className={linkStyles} onClick={onToggleNav}>
          الباقات
        </Link>
      </li>
      <li>
        <Link to="/classes" className={linkStyles} onClick={onToggleNav}>
          خدماتنا
        </Link>
      </li>
      <li>
        <Link to="/protiens" className={linkStyles} onClick={onToggleNav}>
          منجاتنا
        </Link>
      </li>
      {/* <li>
        <Link to="/contact" className={linkStyles} onClick={onToggleNav}>
          تواصل معنا
        </Link>
      </li> */}
    </ul>
  );
  
}

export default NavLinks;
