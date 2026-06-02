import img from "../../images/choose-us/main.webp";

function Image() {
  return (
    <div className="relative flex before:absolute before:bottom-0 before:left-3 before:h-64 before:w-3 before:bg-red after:absolute after:bottom-0 after:right-8 after:top-[-30px] after:w-3 after:rotate-[-6deg] after:bg-red">
      <img src={img} alt="" className="m-auto w-4/5" />
   
    </div>
  );
}

export default Image;
