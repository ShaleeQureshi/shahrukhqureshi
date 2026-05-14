import Projects, { SERVER_ASCII } from './Projects';

export default function Server() {
  return (
    <Projects
      category="server"
      cmd="cat ./server"
      active="server"
      ascii={SERVER_ASCII}
      path="~/server"
    />
  );
}
