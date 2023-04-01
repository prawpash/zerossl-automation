# ZeroSSL Automation

A Typescript application to create new certificate on ZeroSSL

# Step to use this application

1. clone this repository to your computer
2. run command

`yarn install`

3. copy .env.example to become .env
4. define API_KEY variable inside .env file
5. and run this command

   `yarn start --csr-path=your_csr_file_location --domain=your_domain_or_ip --project-dir=your_application_directory`

Example

`yarn start --csr-path=./example.csr --domain=example.com --project-dir=/var/www/example-project`
