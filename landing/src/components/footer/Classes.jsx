import { Link } from "react-router-dom";

const linkStyles = `focus font-medium text-gray-300 transition-all duration-300 hover:ml-2 hover:text-red`;

function Classes() {
  return (
    <div className="space-y-5 2xl:w-48 2xl:justify-self-center">
      <h4 className="relative pb-2 text-xl font-semibold capitalize before:absolute before:bottom-0 before:h-1 before:w-16 before:bg-red">
        حصصنا
      </h4>
      <ul className="space-y-5">
     




        <li>
          <Link className={linkStyles}>   Fitness</Link>
        </li>
        <li>
          <Link className={linkStyles}> Full body</Link>
        </li>
        <li>
          <Link className={linkStyles}> Upper_ Lower</Link>
        </li>
        <li>
          <Link className={linkStyles}> Push_pull_Legs</Link>
        </li>
        <li>
          <Link className={linkStyles}>  Pro split</Link>
        </li>
      </ul>
    </div>
  );
}

export default Classes;
