# Use AWS official base image for Python 3.12 Lambda
FROM public.ecr.aws/lambda/python:3.12

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ${LAMBDA_TASK_ROOT}/backend/

# Create the mangum lambda entrypoint file inside Lambda task root
RUN echo 'from backend.api.main import app; from mangum import Mangum; handler = Mangum(app, lifespan="off")' > ${LAMBDA_TASK_ROOT}/lambda_handler.py

# Set CMD to point to your handler
CMD [ "lambda_handler.handler" ]