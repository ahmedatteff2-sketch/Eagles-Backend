import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
} from "react-icons/fa6";

const linkStyles = `focus rounded-full bg-gray-50 p-4 text-gray-400 hover:bg-red hover:text-white transition-colors duration-300`;

function SocialLinks() {
  return (
    <div>

  
    <ul className="flex gap-2">
      {/* Facebook */}
      <a
        href="https://www.facebook.com/share/1SiyGixMRB/?mibextid=wwXIfr"
        target="_blank"
        rel="noopener noreferrer"
        className={linkStyles}
      >
        <FaFacebookF />
      </a>

      {/* Instagram */}
      <a
        href="https://www.instagram.com/shazly_gym?igsh=MXZhZXllOTdsaHkz&utm_source=qr"
        target="_blank"
        rel="noopener noreferrer"
        className={linkStyles}
      >
        <FaInstagram />
      </a>

      {/* TikTok */}
      <a
        href="https://www.tiktok.com/@shazly.gym?_t=ZS-90onHCZMJSp&_r=1"
        target="_blank"
        rel="noopener noreferrer"
        className={linkStyles}
      >
        <FaTiktok />
      </a>

      {/* WhatsApp */}
      <a
      href="https://wa.me/201124045247"
        target="_blank"
        rel="noopener noreferrer"
        className={linkStyles}
      >
        <FaWhatsapp />
      </a>
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
