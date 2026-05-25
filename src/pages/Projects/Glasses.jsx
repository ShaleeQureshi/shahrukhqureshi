import Projects, { GLASSES_ASCII } from './Projects';

export default function Glasses() {
  return (
    <Projects
      category="glasses"
      cmd="cat ./glasses"
      active="glasses"
      ascii={GLASSES_ASCII}
      path="~/glasses"
    />
  );
}
