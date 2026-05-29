import { FaTiktok, FaInstagram, FaSquareFacebook  ,FaWhatsapp } from "react-icons/fa6";

function Share() {
  return (
    <div className="hidden rotate-[270deg] items-center justify-center gap-4 xl:flex">
      <div className="flex gap-4 text-white">
        {/* TikTok */}
        <a
          href="https://www.tiktok.com/@shazly.gym?_t=ZS-90onHCZMJSp&_r=1"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-red"
        >
          <FaTiktok className="h-auto w-7 rotate-90" />
        </a>

        {/* Instagram */}
        <a
          href="https://www.instagram.com/shazly_gym?igsh=MXZhZXllOTdsaHkz&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-red"
        >
          <FaInstagram className="h-auto w-7 rotate-90" />
        </a>

        {/* Facebook */}
        <a
          href="https://www.facebook.com/share/1SiyGixMRB/?mibextid=wwXIfr"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-300 hover:text-red"
        >
          <FaSquareFacebook className="h-auto w-7 rotate-90" />
        </a>
          {/* WhatsApp */}
              <a
                  href="https://wa.me/201124045247"
                target="_blank"
                rel="noopener noreferrer"
                 className="transition-colors duration-300 hover:text-red"
              >
                <FaWhatsapp className="h-auto w-7 rotate-90" />
              </a>
      </div>

      <div className="h-0.5 w-12 bg-red"></div>

      <p className="inline-block text-lg font-bold uppercase text-white">
        مشاركة
      </p>
    </div>
  );
}

export default Share;
