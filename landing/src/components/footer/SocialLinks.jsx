import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
} from "react-icons/fa6";
import { useLandingContent } from "../../content/LandingContentContext";

const linkStyles = `focus rounded-full bg-gray-50 p-4 text-gray-400 hover:bg-red hover:text-white transition-colors duration-300`;

function SocialLinks() {
  const { social } = useLandingContent();
  return (
    <div>

  
    <ul className="flex gap-2">
      {social.facebook ? (
        <a href={social.facebook} target="_blank" rel="noopener noreferrer" className={linkStyles}>
          <FaFacebookF />
        </a>
      ) : null}

      {social.instagram ? (
        <a href={social.instagram} target="_blank" rel="noopener noreferrer" className={linkStyles}>
          <FaInstagram />
        </a>
      ) : null}

      {social.tiktok ? (
        <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className={linkStyles}>
          <FaTiktok />
        </a>
      ) : null}

      {social.whatsapp ? (
        <a href={social.whatsapp} target="_blank" rel="noopener noreferrer" className={linkStyles}>
          <FaWhatsapp />
        </a>
      ) : null}
    </ul>



    <div className="w-full h-[150px] mt-10">
      <h1 className="mb-5">موقعنا</h1>
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d435.35469467537837!2d31.084507175186886!3d29.198909056105038!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMjnCsDExJzU1LjQiTiAzMcKwMDQnNTQuMSJF!5e0!3m2!1sar!2sjo!4v1764005681642!5m2!1sar!2sjo"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
    </div>
  );
}

export default SocialLinks;
