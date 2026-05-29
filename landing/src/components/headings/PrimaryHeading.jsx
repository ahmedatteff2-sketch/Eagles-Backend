import { useLandingContent } from "../../content/LandingContentContext";

function PrimaryHeading() {
  const { hero } = useLandingContent();
  return (
    <h1 className="text-5xl font-bold leading-normal text-white">
      {hero.headingTop}
      <br /> <span className="font-regular">{hero.headingBottom}</span>
    </h1>
  );
}

export default PrimaryHeading;
