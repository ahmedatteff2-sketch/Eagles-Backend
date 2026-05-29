import SecondaryHeading from "../headings/SecondaryHeading";
import TertiaryHeading from "../headings/TertiaryHeading";
import { useLandingContent } from "../../content/LandingContentContext";

function Title() {
  const { about } = useLandingContent();
  return (
    <>
      <SecondaryHeading>من نحن</SecondaryHeading>
      <TertiaryHeading>{about.heading}</TertiaryHeading>
      <p className="mb-14 font-medium text-gray-400">{about.paragraph}</p>
    </>
  );
}

export default Title;
