import { Link } from "react-router-dom";
import logoWhite from "../../images/logo/Logo-removebg-preview.png";
import logoBlack from "../../images/logo/logo-bg-white.png";

function Logo({ height = "h-20", size = "w-full", type = "white" }) {
  return (
    <Link to="/" className="focus inline-block">
      <img
        src={type === "black" ? logoBlack : logoWhite}
        alt="Eagle logo"
        className={`${height} relative ${size}`}
      />
    </Link>
  );
}

export default Logo;
