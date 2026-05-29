import { FaTiktok, FaInstagram, FaSquareFacebook, FaWhatsapp } from "react-icons/fa6";
import { useLandingContent } from "../../content/LandingContentContext";

function Share() {
  const { social } = useLandingContent();
  return (
    <div className="hidden rotate-[270deg] items-center justify-center gap-4 xl:flex">
      <div className="flex gap-4 text-white">
        {social.tiktok ? (
          <a
            href={social.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-red"
          >
            <FaTiktok className="h-auto w-7 rotate-90" />
          </a>
        ) : null}

        {social.instagram ? (
          <a
            href={social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-red"
          >
            <FaInstagram className="h-auto w-7 rotate-90" />
          </a>
        ) : null}

        {social.facebook ? (
          <a
            href={social.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-red"
          >
            <FaSquareFacebook className="h-auto w-7 rotate-90" />
          </a>
        ) : null}

        {social.whatsapp ? (
          <a
            href={social.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-red"
          >
            <FaWhatsapp className="h-auto w-7 rotate-90" />
          </a>
        ) : null}
      </div>

      <div className="h-0.5 w-12 bg-red"></div>

      <p className="inline-block text-lg font-bold uppercase text-white">
        مشاركة
      </p>
    </div>
  );
}

export default Share;
